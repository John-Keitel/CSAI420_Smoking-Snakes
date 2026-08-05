import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Exercises the graded Week 4 escalation contract end to end (route -> handler ->
 * classifier -> sanitizer -> repository -> queue) against an in-memory store, so
 * the full cycle is verifiable without a live Postgres instance.
 */

type EscalationRow = {
    id: string;
    escalationId: string;
    userId: string | null;
    sessionId: string | null;
    phoneNumber: string;
    originalQuestion: string;
    aiResponse: string;
    responsePreference: 'CALL' | 'TEXT' | 'CHAT';
    waitingForResponse: boolean;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    category: 'GENERAL' | 'MEDICAL' | 'TECHNICAL';
    status: 'PENDING' | 'ASSIGNED' | 'RESOLVED';
    coachId: string | null;
    questionTimestamp: Date;
    escalationTimestamp: Date;
    resolutionTimestamp: Date | null;
};

const store = vi.hoisted(() => ({
    rows: new Map<string, EscalationRow>(),
    sequence: 0,
}));

const { loggerMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        escalation: {
            create: vi.fn(async ({ data }: { data: Omit<EscalationRow, 'id' | 'escalationTimestamp'> }) => {
                store.sequence += 1;
                const row: EscalationRow = {
                    id: `row-${store.sequence}`,
                    escalationId: data.escalationId,
                    userId: data.userId ?? null,
                    sessionId: data.sessionId ?? null,
                    phoneNumber: data.phoneNumber,
                    originalQuestion: data.originalQuestion,
                    aiResponse: data.aiResponse,
                    responsePreference: data.responsePreference,
                    waitingForResponse: data.waitingForResponse,
                    priority: data.priority,
                    category: data.category,
                    status: data.status ?? 'PENDING',
                    coachId: null,
                    questionTimestamp: data.questionTimestamp,
                    escalationTimestamp: new Date('2026-07-26T14:30:15.000Z'),
                    resolutionTimestamp: null,
                };
                store.rows.set(row.escalationId, row);
                return { ...row };
            }),
            findUnique: vi.fn(async ({ where }: { where: { escalationId: string } }) => {
                const row = store.rows.get(where.escalationId);
                return row ? { ...row } : null;
            }),
            deleteMany: vi.fn(async ({ where }: { where: { escalationId: string } }) => {
                return { count: store.rows.delete(where.escalationId) ? 1 : 0 };
            }),
        },
    },
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/escalate-question/route';
import { DELETE, GET } from '@/app/escalation/[escalationId]/route';

const sessionHeaders = { 'content-type': 'application/json', 'suresteps.session.token': 'test-token' };

const medical = {
    phoneNumber: '+1234567890',
    question: "I'm having chest pain after my balance test, should I be worried?",
    aiResponse: 'I cannot provide medical advice about chest pain. Let me connect you with a healthcare professional.',
    responsePreference: 'call',
    waitingForResponse: true,
    sessionId: 'session_medical_123',
    userId: 'user_67890',
};

const technical = {
    phoneNumber: '+1987654321',
    question: 'The app keeps crashing when I try to view my balance scores',
    aiResponse: "I'm unable to diagnose technical issues with the app. Let me connect you with our technical support team.",
    responsePreference: 'chat',
    waitingForResponse: false,
    sessionId: 'session_tech_456',
    userId: 'user_12345',
};

async function escalate(payload: Record<string, unknown>) {
    const response = await POST(
        new NextRequest('http://localhost/escalate-question', {
            method: 'POST',
            headers: sessionHeaders,
            body: JSON.stringify({ ...payload, timestamp: '2026-07-26T14:30:00.000Z' }),
        })
    );
    return { response, body: await response.json() };
}

async function fetchStatus(escalationId: string) {
    const response = await GET(new NextRequest(`http://localhost/escalation/${escalationId}`, { headers: sessionHeaders }), {
        params: Promise.resolve({ escalationId }),
    });
    return { response, body: response.status === 204 ? null : await response.json() };
}

describe('escalation full cycle', () => {
    beforeEach(() => {
        store.rows.clear();
        store.sequence = 0;
        vi.clearAllMocks();
    });

    it('escalates a medical question and reports it as high priority', async () => {
        const { response, body } = await escalate(medical);

        expect(response.status).toBe(200);
        expect(body.status).toBe('escalated');
        expect(body.escalationId).toMatch(/^esc_[a-zA-Z0-9]+$/);
        expect(body.message).toMatch(/forwarded to a healthcare coach/i);

        const status = await fetchStatus(body.escalationId);
        expect(status.response.status).toBe(200);
        expect(status.body).toMatchObject({
            escalationId: body.escalationId,
            status: 'pending',
            priority: 'high',
            category: 'medical',
            responsePreference: 'call',
            phoneNumber: '+1234567890',
        });
        expect(status.body.escalationTimestamp).toBe('2026-07-26T14:30:15.000Z');
    });

    it('escalates an app defect into the technical lane', async () => {
        const { body } = await escalate(technical);
        const { body: status } = await fetchStatus(body.escalationId);

        expect(status.category).toBe('technical');
        expect(['medium', 'low']).toContain(status.priority);
    });

    it('stores escalated free text with markup stripped', async () => {
        const { body } = await escalate({
            ...medical,
            question: '<script>alert("xss")</script>This is a test question',
            aiResponse: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
        });

        const { body: status } = await fetchStatus(body.escalationId);
        expect(status.originalQuestion).not.toContain('<script>');
        expect(status.aiResponse).not.toContain('<!DOCTYPE');
    });

    it('handles five concurrent escalations', async () => {
        const results = await Promise.all(
            Array.from({ length: 5 }, (_, index) => escalate({ ...medical, question: `Bulk test question ${index}` }))
        );

        for (const { response } of results) {
            expect([200, 429]).toContain(response.status);
        }
        expect(store.rows.size).toBe(5);
    });

    it('mints a distinct escalation id per request', async () => {
        const first = await escalate(medical);
        const second = await escalate(medical);

        expect(first.body.escalationId).not.toBe(second.body.escalationId);
    });

    it('returns 404 for an escalation that was never created', async () => {
        const { response } = await fetchStatus('esc_nonexistent123');
        expect(response.status).toBe(404);
    });

    it('deletes an escalation and then reports it as missing', async () => {
        const { body } = await escalate(medical);

        const deleted = await DELETE(
            new NextRequest(`http://localhost/escalation/${body.escalationId}`, {
                method: 'DELETE',
                headers: sessionHeaders,
            }),
            { params: Promise.resolve({ escalationId: body.escalationId }) }
        );
        expect(deleted.status).toBe(204);

        const { response } = await fetchStatus(body.escalationId);
        expect(response.status).toBe(404);
    });
});

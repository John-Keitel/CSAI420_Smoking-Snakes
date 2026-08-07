import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createEscalationMock, publishEscalationMessageMock, loggerMock } = vi.hoisted(() => ({
    createEscalationMock: vi.fn(),
    publishEscalationMessageMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/escalation/repository', () => ({
    createEscalation: createEscalationMock,
}));
vi.mock('@/lib/escalation/queue', () => ({
    publishEscalationMessage: publishEscalationMessageMock,
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/escalate-registration/route';

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/escalate-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const validPayload = {
    phoneNumber: '8014567890',
    registrationData: {
        partialEmail: 'confused_user@',
        attemptedSteps: ['name_collection', 'email_collection'],
    },
    chatSessionId: 'session_1234567890',
    issueType: 'confusion_about_process',
    aiResponse: 'I understand you are having trouble. Let me connect you with a support agent.',
    responsePreference: 'chat',
    conversationContext: [
        { role: 'user', message: "I don't understand what you're asking" },
        { role: 'assistant', message: 'Let me try to explain...' },
        { role: 'user', message: "I'm still confused, can someone help me?" },
    ],
};

const storedEscalation = {
    id: 'uuid-1',
    escalationId: 'esc_abc123',
    status: 'PENDING',
    priority: 'MEDIUM',
    category: 'GENERAL',
    originalQuestion: "I'm still confused, can someone help me?",
    aiResponse: 'I understand you are having trouble. Let me connect you with a support agent.',
    phoneNumber: '8014567890',
    responsePreference: 'CHAT',
    waitingForResponse: true,
    questionTimestamp: new Date('2026-08-01T12:00:00.000Z'),
    escalationTimestamp: new Date('2026-08-01T12:00:01.000Z'),
    resolutionTimestamp: null,
    coachId: null,
    sessionId: 'session_1234567890',
    userId: null,
};

beforeEach(() => {
    vi.resetAllMocks();
    createEscalationMock.mockResolvedValue(storedEscalation);
    publishEscalationMessageMock.mockResolvedValue({ published: true, messageId: 'msg-1' });
});

describe('POST /escalate-registration', () => {
    it('escalates with the Week 5 contract for a confused user (ESC-01)', async () => {
        const response = await POST(buildRequest(validPayload));

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.status).toBe('escalated');
        expect(data.escalationId).toBe('esc_abc123');
        expect(data).toHaveProperty('estimatedResponseTime');
        expect(data.message).toContain('support team');

        expect(createEscalationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                sessionId: 'session_1234567890',
                originalQuestion: "I'm still confused, can someone help me?",
                priority: 'MEDIUM',
                category: 'GENERAL',
                responsePreference: 'CHAT',
                waitingForResponse: true,
            })
        );
        expect(publishEscalationMessageMock).toHaveBeenCalledWith(expect.objectContaining({ escalationId: 'esc_abc123', priority: 'medium' }));
    });

    it('returns exactly "15-30 minutes" for technical difficulties (ESC-02)', async () => {
        createEscalationMock.mockResolvedValue({ ...storedEscalation, priority: 'HIGH', category: 'TECHNICAL' });

        const response = await POST(
            buildRequest({
                ...validPayload,
                issueType: 'technical_difficulties',
                responsePreference: 'call',
                conversationContext: [{ role: 'user', message: 'The app keeps crashing when I try to enter my password' }],
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.estimatedResponseTime).toBe('15-30 minutes');
        expect(createEscalationMock).toHaveBeenCalledWith(expect.objectContaining({ priority: 'HIGH', category: 'TECHNICAL' }));
    });

    it('escalates account creation failures with the same contract (ESC-03)', async () => {
        const response = await POST(
            buildRequest({
                ...validPayload,
                issueType: 'account_creation_failed',
                responsePreference: 'text',
            })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.status).toBe('escalated');
        expect(data.estimatedResponseTime).toBe('30-60 minutes');
    });

    it('returns 400 with a non-empty errors array for invalid input (ESC-04)', async () => {
        const invalidPayload = {
            phoneNumber: 'invalid-phone',
            issueType: 'unknown_issue_type',
        };

        const response = await POST(buildRequest(invalidPayload));

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.errors).toBeInstanceOf(Array);
        expect(data.errors.length).toBeGreaterThan(0);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an empty body', async () => {
        const response = await POST(buildRequest({}));

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.errors).toBeInstanceOf(Array);
        expect(data.errors.length).toBeGreaterThan(0);
    });

    it('still answers 200 when the queue publish fails (durable-first policy)', async () => {
        publishEscalationMessageMock.mockResolvedValue({ published: false, messageId: null });

        const response = await POST(buildRequest(validPayload));

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.status).toBe('escalated');
        expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('falls back to a registrationData summary when there is no user message', async () => {
        const noContextPayload = {
            ...validPayload,
            conversationContext: [{ role: 'assistant', message: 'How can I help?' }],
            registrationData: { partialEmail: 'confused_user@' },
        };

        await POST(buildRequest(noContextPayload));

        expect(createEscalationMock).toHaveBeenCalledWith(expect.objectContaining({ originalQuestion: '{"partialEmail":"confused_user@"}' }));
    });

    it('sanitizes markup from the stored question and AI response', async () => {
        const maliciousPayload = {
            ...validPayload,
            conversationContext: [{ role: 'user', message: '<script>alert(1)</script>help' }],
            aiResponse: 'Thanks! <b>OK</b>',
        };

        await POST(buildRequest(maliciousPayload));

        expect(createEscalationMock).toHaveBeenCalledWith(
            expect.objectContaining({ originalQuestion: 'alert(1) help', aiResponse: 'Thanks! OK' })
        );
    });
});

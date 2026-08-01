import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleEscalationMock, loggerMock } = vi.hoisted(() => ({
    handleEscalationMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/escalation', () => ({ handleEscalation: handleEscalationMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/escalate-question/route';

const sessionHeaders = { 'content-type': 'application/json', 'suresteps.session.token': 'test-token' };

const validPayload = {
    phoneNumber: '+1234567890',
    question: "I'm having chest pain after my balance test, should I be worried?",
    aiResponse: 'I cannot provide medical advice. Let me connect you with a healthcare professional.',
    responsePreference: 'call',
    waitingForResponse: true,
    sessionId: 'session_medical_123',
    userId: 'user_67890',
};

function buildRequest(body: string, headers: Record<string, string> = sessionHeaders): NextRequest {
    return new NextRequest('http://localhost/escalate-question', { method: 'POST', headers, body });
}

function postJson(body: unknown, headers?: Record<string, string>) {
    return POST(buildRequest(JSON.stringify(body), headers));
}

describe('POST /escalate-question', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        handleEscalationMock.mockResolvedValue({
            escalation: { escalationId: 'esc_abc123' },
            estimatedResponseTime: '15-30 minutes',
        });
    });

    it('escalates a valid request and returns the confirmation contract', async () => {
        const response = await postJson(validPayload);

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            status: 'escalated',
            escalationId: 'esc_abc123',
            estimatedResponseTime: '15-30 minutes',
            message: 'Your question has been forwarded to a healthcare coach',
        });
    });

    it('mints an escalation id consumers can match on', async () => {
        const { escalationId } = await (await postJson(validPayload)).json();
        expect(escalationId).toMatch(/^esc_[a-zA-Z0-9]+$/);
    });

    it('rejects an unauthenticated request', async () => {
        const response = await postJson(validPayload, { 'content-type': 'application/json' });

        expect(response.status).toBe(401);
        expect(handleEscalationMock).not.toHaveBeenCalled();
    });

    it('rejects a payload missing required fields', async () => {
        const response = await postJson({ phoneNumber: '+1234567890' });

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toMatchObject({ message: 'validation error' });
    });

    it('rejects a phone number that is not E.164', async () => {
        const response = await postJson({ ...validPayload, phoneNumber: 'invalid-phone-number' });
        expect(response.status).toBe(400);
    });

    it('rejects an unsupported response preference', async () => {
        const response = await postJson({ ...validPayload, responsePreference: 'invalid-preference' });
        expect(response.status).toBe(400);
    });

    it('rejects malformed JSON without a server error', async () => {
        const response = await POST(buildRequest('invalid-json-{'));
        expect(response.status).toBe(400);
    });

    it('rejects an empty body without a server error', async () => {
        const response = await POST(buildRequest(''));
        expect(response.status).toBe(400);
    });

    it('returns a meaningful error for an empty object payload', async () => {
        const response = await postJson({});

        expect(response.status).toBe(400);
        const body = await response.json();
        expect(Object.keys(body.errors).length).toBeGreaterThan(0);
    });

    it('surfaces an unexpected handler failure as a 500', async () => {
        handleEscalationMock.mockRejectedValue(new Error('queue exploded'));

        const response = await postJson(validPayload);

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Server Error' });
    });
});

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock, validateSessionMock, createEscalationMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    validateSessionMock: vi.fn(),
    createEscalationMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
vi.mock('@/lib/auth/suresteps', () => ({ validateSureStepsSession: validateSessionMock }));
// Mock only the repository leaf module (the one that imports @/lib/db) — this keeps the real
// @/lib/escalation barrel exports (ESTIMATED_RESPONSE_TIME_BY_PRIORITY, classifyEscalation,
// sanitizeText, ...) live instead of hand-duplicating them here.
vi.mock('@/lib/escalation/repository', () => ({ createEscalation: createEscalationMock }));

import { POST } from '@/app/escalate-question/route';

const validPayload = {
    phoneNumber: '+1234567890',
    question: "I'm having chest pain after my balance test, should I be worried?",
    aiResponse: 'I cannot provide medical advice about chest pain. Let me connect you with a healthcare professional.',
    responsePreference: 'call',
    waitingForResponse: true,
    sessionId: 'session_medical_123',
    userId: 'user_67890',
    timestamp: new Date().toISOString(),
};

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/escalate-question', {
        method: 'POST',
        headers: { 'suresteps.session.token': 'legacy-session-token', 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('POST /escalate-question', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        validateSessionMock.mockReturnValue({ ok: true, user: { id: 'user_67890' } });
    });

    it('returns 401 when the session token is missing/invalid', async () => {
        validateSessionMock.mockReturnValue({ ok: false, reason: 'Missing suresteps.session.token header' });

        const response = await POST(buildRequest(validPayload));

        expect(response.status).toBe(401);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });

    it('escalates a valid request and returns the expected shape', async () => {
        createEscalationMock.mockResolvedValue({
            escalationId: 'esc_abc123',
            priority: 'high',
            category: 'medical',
            status: 'pending',
        });

        const response = await POST(buildRequest(validPayload));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('escalated');
        expect(body.escalationId).toMatch(/^esc_[a-zA-Z0-9]+$/);
        expect(body.estimatedResponseTime).toBeDefined();
        expect(body.message).toMatch(/forwarded to a healthcare coach/i);
        expect(createEscalationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                phoneNumber: validPayload.phoneNumber,
                question: validPayload.question,
                aiResponse: validPayload.aiResponse,
                responsePreference: 'call',
            })
        );
    });

    it('returns 400 when required fields are missing', async () => {
        const response = await POST(buildRequest({ phoneNumber: '+1234567890' }));

        expect(response.status).toBe(400);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid phone number', async () => {
        const response = await POST(buildRequest({ ...validPayload, phoneNumber: 'invalid-phone-number' }));

        expect(response.status).toBe(400);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an invalid responsePreference', async () => {
        const response = await POST(buildRequest({ ...validPayload, responsePreference: 'invalid-preference' }));

        expect(response.status).toBe(400);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 for malformed JSON', async () => {
        const response = await POST(buildRequest('invalid-json-{'));

        expect(response.status).toBe(400);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an empty body', async () => {
        const response = await POST(buildRequest(''));

        expect(response.status).toBe(400);
        expect(createEscalationMock).not.toHaveBeenCalled();
    });
});

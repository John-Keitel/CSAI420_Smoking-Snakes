import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock, createRegistrationEscalationMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    createRegistrationEscalationMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

// Mock only the repository leaf module (the one that imports @/lib/db) — response-time.ts and
// issue-type.ts don't touch Prisma/ENV_VARS, so the real barrel (index.ts) can still import them
// unmocked and the route's real ESTIMATED_RESPONSE_TIME_BY_PRIORITY lookup runs for real.
vi.mock('@/lib/escalation/repository', () => ({ createRegistrationEscalation: createRegistrationEscalationMock }));

import { POST } from '@/app/escalate-registration/route';

const confusionPayload = {
    phoneNumber: '8014567890',
    registrationData: { partialEmail: 'confused_user@', attemptedSteps: ['name_collection', 'email_collection'] },
    chatSessionId: 'session_123',
    issueType: 'confusion_about_process',
    aiResponse: "I understand you're having trouble. Let me connect you with a support agent.",
    responsePreference: 'chat',
    conversationContext: [{ role: 'user', message: "I don't understand what you're asking" }],
};

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/escalate-registration', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

function fakeEscalation(overrides: Partial<{ escalationId: string; priority: 'high' | 'medium' | 'low' }> = {}) {
    return {
        id: 'cuid_1',
        escalationId: overrides.escalationId ?? 'esc_abc123',
        userId: null,
        phoneNumber: confusionPayload.phoneNumber,
        originalQuestion: null,
        aiResponse: confusionPayload.aiResponse,
        responsePreference: 'chat',
        waitingForResponse: false,
        priority: overrides.priority ?? 'medium',
        category: 'registration',
        status: 'pending',
        questionTimestamp: null,
        escalationTimestamp: new Date(),
        issueType: 'confusion_about_process',
        registrationData: confusionPayload.registrationData,
        conversationContext: confusionPayload.conversationContext,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
}

describe('POST /escalate-registration', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        createRegistrationEscalationMock.mockResolvedValue(fakeEscalation());
    });

    it('escalates a confusion_about_process issue and returns the expected shape', async () => {
        const response = await POST(buildRequest(confusionPayload));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('escalated');
        expect(body).toHaveProperty('escalationId', 'esc_abc123');
        expect(body).toHaveProperty('estimatedResponseTime');
        expect(body.message).toMatch(/support team/i);
        expect(createRegistrationEscalationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                phoneNumber: confusionPayload.phoneNumber,
                issueType: 'confusion_about_process',
                aiResponse: confusionPayload.aiResponse,
                responsePreference: 'chat',
            })
        );
    });

    it('returns exactly "15-30 minutes" for technical_difficulties', async () => {
        createRegistrationEscalationMock.mockResolvedValue(fakeEscalation({ priority: 'high' }));

        const response = await POST(
            buildRequest({
                phoneNumber: '8014567890',
                registrationData: { error: 'app_crash_on_password_entry', deviceInfo: 'iOS 17.0, iPhone 14' },
                chatSessionId: 'session_456',
                issueType: 'technical_difficulties',
                aiResponse: "I'm sorry you're experiencing technical issues. Let me get you immediate help.",
                responsePreference: 'call',
                conversationContext: [{ role: 'user', message: 'The app keeps crashing when I try to enter my password' }],
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.estimatedResponseTime).toBe('15-30 minutes');
        expect(createRegistrationEscalationMock).toHaveBeenCalledWith(expect.objectContaining({ issueType: 'technical_difficulties' }));
    });

    it('escalates an account_creation_failed issue', async () => {
        const response = await POST(
            buildRequest({
                phoneNumber: '8014567890',
                registrationData: { email: 'failed_user@example.com', errorCode: 'DUPLICATE_EMAIL', attemptCount: 3 },
                chatSessionId: 'session_789',
                issueType: 'account_creation_failed',
                aiResponse: 'I encountered an error creating your account. Let me get human assistance.',
                responsePreference: 'text',
                conversationContext: [{ role: 'user', message: "But I've never used this email before!" }],
            })
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.status).toBe('escalated');
        expect(body).toHaveProperty('escalationId');
    });

    it('returns 400 with an errors array for an invalid phone number and missing fields', async () => {
        const response = await POST(buildRequest({ phoneNumber: 'invalid-phone', issueType: 'unknown_issue_type' }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(Array.isArray(body.errors)).toBe(true);
        expect(body.errors.length).toBeGreaterThan(0);
        expect(createRegistrationEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 when required fields are missing entirely', async () => {
        const response = await POST(buildRequest({}));

        expect(response.status).toBe(400);
        expect(createRegistrationEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 400 for an issueType outside the known enum', async () => {
        const response = await POST(buildRequest({ ...confusionPayload, issueType: 'not_a_real_issue_type' }));

        expect(response.status).toBe(400);
        expect(createRegistrationEscalationMock).not.toHaveBeenCalled();
    });

    it('accepts a lenient phone format without a leading "+"', async () => {
        const response = await POST(buildRequest({ ...confusionPayload, phoneNumber: '8014567890' }));

        expect(response.status).toBe(200);
    });

    it('accepts the "email" response preference', async () => {
        const response = await POST(buildRequest({ ...confusionPayload, responsePreference: 'email' }));

        expect(response.status).toBe(200);
        expect(createRegistrationEscalationMock).toHaveBeenCalledWith(expect.objectContaining({ responsePreference: 'email' }));
    });
});

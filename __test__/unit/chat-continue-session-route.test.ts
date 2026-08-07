import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sessionFindUnique, sessionCreate, sessionUpdate, loggerMock } = vi.hoisted(() => ({
    sessionFindUnique: vi.fn(),
    sessionCreate: vi.fn(),
    sessionUpdate: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        chatRegistrationSession: {
            findUnique: sessionFindUnique,
            create: sessionCreate,
            update: sessionUpdate,
        },
    },
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { advanceChat, POST } from '@/app/chat/continue-session/route';

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/chat/continue-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const freshSession = {
    id: 'uuid-1',
    chatSessionId: 'context_session_1',
    conversationContext: [],
    currentStep: 'initial_greeting',
    lastActivity: new Date('2026-08-01T12:00:00.000Z'),
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
};

beforeEach(() => {
    vi.resetAllMocks();
    sessionFindUnique.mockResolvedValue(null);
    sessionCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
        ...freshSession,
        chatSessionId: data.chatSessionId,
        conversationContext: data.conversationContext,
        currentStep: data.currentStep,
    }));
    sessionUpdate.mockResolvedValue({});
});

describe('POST /chat/continue-session', () => {
    it('answers 200 with the Week 5 shape and persists the first turn (SES-01)', async () => {
        const response = await POST(
            buildRequest({ chatSessionId: 'context_session_1', message: 'I need help signing up', context: 'initial_greeting' })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data).toHaveProperty('response');
        expect(data).toHaveProperty('conversationContext');
        expect(data).toHaveProperty('nextStep');
        expect(data.sessionActive).toBe(true);
        expect(data.conversationContext).toHaveLength(2);
        expect(data.conversationContext[0]).toMatchObject({ role: 'user', message: 'I need help signing up' });
        expect(data.conversationContext[1]).toMatchObject({ role: 'assistant' });
    });

    it('grows the conversation context across calls with the same session id (SES-02)', async () => {
        sessionFindUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
            ...freshSession,
            currentStep: 'name_provided',
            conversationContext: [
                { role: 'user', message: 'I need help signing up' },
                { role: 'assistant', message: "I'd be happy to help! What's your name?" },
            ],
        });

        const first = await POST(
            buildRequest({ chatSessionId: 'context_session_1', message: 'I need help signing up', context: 'initial_greeting' })
        );
        const firstBody = await first.json();
        expect(firstBody.conversationContext.length).toBeGreaterThan(1);

        const second = await POST(buildRequest({ chatSessionId: 'context_session_1', message: 'John Doe', context: 'name_provided' }));
        const secondBody = await second.json();
        expect(secondBody.conversationContext.length).toBeGreaterThan(1);
        expect(secondBody.conversationContext).toHaveLength(4);
    });

    it('creates a fresh session for an unknown session id (SES-03)', async () => {
        const response = await POST(buildRequest({ chatSessionId: 'brand_new_session_1', message: 'hello' }));

        expect(response.status).toBe(200);
        expect(sessionCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({ chatSessionId: 'brand_new_session_1', currentStep: 'initial_greeting' }),
        });
    });

    it('persists state to the database, not memory (SES-04)', async () => {
        await POST(buildRequest({ chatSessionId: 'context_session_1', message: 'I need help signing up' }));

        expect(sessionUpdate).toHaveBeenCalledWith({
            where: { chatSessionId: 'context_session_1' },
            data: expect.objectContaining({
                currentStep: 'name_provided',
                conversationContext: expect.arrayContaining([expect.objectContaining({ role: 'user', message: 'I need help signing up' })]),
                lastActivity: expect.any(Date),
            }),
        });
    });

    it('advances the state machine step by step', () => {
        expect(advanceChat('initial_greeting')).toEqual({ response: expect.any(String), nextStep: 'name_provided' });
        expect(advanceChat('name_provided').nextStep).toBe('email_collection');
        expect(advanceChat('birth_date_collection').nextStep).toBe('password_collection');
        expect(advanceChat('completion').nextStep).toBe('completion');
    });

    it('sanitizes user messages before storing them', async () => {
        const response = await POST(buildRequest({ chatSessionId: 'context_session_1', message: '<script>alert(1)</script>help' }));
        const data = await response.json();
        expect(data.conversationContext[0].message).not.toContain('<script>');
    });

    it('returns 400 for a missing message or chatSessionId', async () => {
        const noMessage = await POST(buildRequest({ chatSessionId: 'session_1' }));
        expect(noMessage.status).toBe(400);
        const noMessageBody = await noMessage.json();
        expect(noMessageBody.errors).toBeInstanceOf(Array);

        const noSession = await POST(buildRequest({ message: 'hello' }));
        expect(noSession.status).toBe(400);
    });
});

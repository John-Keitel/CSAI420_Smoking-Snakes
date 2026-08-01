import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Exercises the Week 5 session-continuation contract end to end (route -> state
 * machine -> repository) against an in-memory store, so the full cycle is
 * verifiable without a live Postgres instance. The store plays the role of the
 * database: state is read back through the repository on every turn, exactly as
 * it would be across restarts or instances.
 */

type ChatSessionRow = {
    id: string;
    chatSessionId: string;
    conversationContext: Array<{ role: 'user' | 'assistant'; message: string }>;
    currentStep: string;
    lastActivity: Date;
    createdAt: Date;
    updatedAt: Date;
};

const store = vi.hoisted(() => ({
    rows: new Map<string, ChatSessionRow>(),
    sequence: 0,
}));

const { loggerMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        chatRegistrationSession: {
            findUnique: vi.fn(async ({ where }: { where: { chatSessionId: string } }) => {
                const row = store.rows.get(where.chatSessionId);
                return row ? { ...row, conversationContext: [...row.conversationContext] } : null;
            }),
            create: vi.fn(async ({ data }: { data: Omit<ChatSessionRow, 'id' | 'lastActivity' | 'createdAt' | 'updatedAt'> }) => {
                store.sequence += 1;
                const now = new Date('2026-08-01T12:00:00.000Z');
                const row: ChatSessionRow = {
                    id: `row-${store.sequence}`,
                    chatSessionId: data.chatSessionId,
                    conversationContext: [...data.conversationContext],
                    currentStep: data.currentStep,
                    lastActivity: now,
                    createdAt: now,
                    updatedAt: now,
                };
                store.rows.set(row.chatSessionId, row);
                return { ...row, conversationContext: [...row.conversationContext] };
            }),
            update: vi.fn(
                async ({
                    where,
                    data,
                }: {
                    where: { chatSessionId: string };
                    data: { conversationContext: ChatSessionRow['conversationContext']; currentStep: string; lastActivity: Date };
                }) => {
                    const row = store.rows.get(where.chatSessionId);
                    if (!row) {
                        throw new Error('session not found');
                    }
                    row.conversationContext = [...data.conversationContext];
                    row.currentStep = data.currentStep;
                    row.lastActivity = data.lastActivity;
                    return { ...row, conversationContext: [...row.conversationContext] };
                }
            ),
        },
    },
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/chat/continue-session/route';

async function continueSession(payload: Record<string, unknown>) {
    const response = await POST(
        new NextRequest('http://localhost/chat/continue-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        })
    );
    return { response, body: await response.json() };
}

describe('chat continue-session full cycle', () => {
    beforeEach(() => {
        store.rows.clear();
        store.sequence = 0;
        vi.clearAllMocks();
    });

    it('grows persisted context across two calls with the same session id', async () => {
        const sessionId = 'context_session_123';

        const first = await continueSession({ chatSessionId: sessionId, message: 'I need help signing up', context: 'initial_greeting' });
        expect(first.response.status).toBe(200);
        expect(first.body.conversationContext).toHaveLength(2);

        const second = await continueSession({ chatSessionId: sessionId, message: 'John Doe', context: 'name_provided' });
        expect(second.response.status).toBe(200);
        expect(second.body.conversationContext.length).toBeGreaterThan(1);
        expect(second.body.conversationContext).toHaveLength(4);
        expect(second.body.conversationContext[2]).toMatchObject({ role: 'user', message: 'John Doe' });

        // The store (database) holds both turns — the route read them back via findUnique.
        const persisted = store.rows.get(sessionId);
        expect(persisted?.conversationContext).toHaveLength(4);
        expect(persisted?.currentStep).toBe('email_collection');
    });

    it('creates a fresh session for an unknown id and answers 200', async () => {
        const { response, body } = await continueSession({ chatSessionId: 'fresh_session_456', message: 'hello' });

        expect(response.status).toBe(200);
        expect(body.sessionActive).toBe(true);
        expect(body.conversationContext).toHaveLength(2);
        expect(store.rows.has('fresh_session_456')).toBe(true);
    });

    it('persists every turn in the store, proving state is not memory-local to the route', async () => {
        const sessionId = 'durable_session_789';

        await continueSession({ chatSessionId: sessionId, message: 'turn one' });
        const mid = store.rows.get(sessionId);
        expect(mid?.conversationContext).toHaveLength(2);

        await continueSession({ chatSessionId: sessionId, message: 'turn two' });
        const after = store.rows.get(sessionId);
        expect(after?.conversationContext).toHaveLength(4);
        expect(after?.currentStep).toBe('email_collection');
    });

    it('returns 400 for a payload missing the message', async () => {
        const { response, body } = await continueSession({ chatSessionId: 'session_1' });
        expect(response.status).toBe(400);
        expect(body.errors).toBeInstanceOf(Array);
        expect(body.errors.length).toBeGreaterThan(0);
    });
});

import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

const { loggerMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
// No OPENAI_API_KEY -> every onboarding node takes its deterministic fallback path, matching
// how the existing onboarding node tests (__test__/unit/onboarding-*.test.ts) exercise the real
// graph without needing to mock LangChain/OpenAI internals.
vi.mock('@/lib/env-vars', () => ({ ENV_VARS: { OPENAI_API_KEY: undefined, OPENAI_MODEL: 'gpt-4o-mini' } }));

import { POST } from '@/app/chat/continue-session/route';

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/chat/continue-session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

// Each test needs its own thread_id: the compiled onboardingGraph (and this route's transcript
// store) are process-wide singletons, so reusing an id across tests would leak state between them.
let sessionCounter = 0;
function freshSessionId(): string {
    sessionCounter += 1;
    return `chat_continue_test_${sessionCounter}`;
}

describe('POST /chat/continue-session', () => {
    it('starts a new session and pauses asking for the name', async () => {
        const chatSessionId = freshSessionId();

        const response = await POST(buildRequest({ chatSessionId, message: 'I need help signing up', context: 'initial_greeting' }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.sessionActive).toBe(true);
        expect(body.nextStep).toBe('COLLECT_NAME');
        expect(body.response).toContain('full name');
        expect(Array.isArray(body.conversationContext)).toBe(true);
        expect(body.conversationContext.length).toBeGreaterThan(0);
    });

    it('resumes with the reply and grows conversationContext past 1 element on the second call', async () => {
        const chatSessionId = freshSessionId();

        const first = await POST(buildRequest({ chatSessionId, message: 'I need help signing up', context: 'initial_greeting' }));
        expect([200, 201]).toContain(first.status);

        const second = await POST(buildRequest({ chatSessionId, message: 'John Doe', context: 'name_provided' }));
        expect([200, 201]).toContain(second.status);

        const secondBody = await second.json();
        expect(secondBody).toHaveProperty('conversationContext');
        expect(secondBody.conversationContext.length).toBeGreaterThan(1);
        expect(secondBody.nextStep).toBe('COLLECT_EMAIL');
        expect(secondBody.response).toContain('email');
        expect(secondBody.sessionActive).toBe(true);
    });

    it('advances through the full flow to COMPLETE with sessionActive=false and a real completion message', async () => {
        const chatSessionId = freshSessionId();

        await POST(buildRequest({ chatSessionId, message: 'start' }));
        await POST(buildRequest({ chatSessionId, message: 'John Smith' }));
        await POST(buildRequest({ chatSessionId, message: 'john@example.com' }));
        await POST(buildRequest({ chatSessionId, message: '1990-01-01' }));
        const final = await POST(buildRequest({ chatSessionId, message: 'Str0ngP@ssw0rd!' }));
        const finalBody = await final.json();

        expect(final.status).toBe(200);
        expect(finalBody.sessionActive).toBe(false);
        expect(finalBody.nextStep).toBe('COMPLETE');
        // Not the leftover GREETING text — the graph itself adds no message on COMPLETE (see
        // session.ts's COMPLETION_MESSAGE comment), so this route must supply its own.
        expect(finalBody.response).not.toContain('full name');
        expect(finalBody.response.length).toBeGreaterThan(0);
    });

    it('reaches ABANDONED after repeated invalid replies with sessionActive=false', async () => {
        const chatSessionId = freshSessionId();

        await POST(buildRequest({ chatSessionId, message: 'start' }));
        await POST(buildRequest({ chatSessionId, message: 'asdf 123' }));
        await POST(buildRequest({ chatSessionId, message: 'asdf 123' }));
        const final = await POST(buildRequest({ chatSessionId, message: 'asdf 123' }));
        const finalBody = await final.json();

        expect(final.status).toBe(200);
        expect(finalBody.sessionActive).toBe(false);
        expect(finalBody.nextStep).toBe('ABANDONED');
    });

    it('does not restart an already-finished session when another message arrives', async () => {
        const chatSessionId = freshSessionId();

        await POST(buildRequest({ chatSessionId, message: 'start' }));
        await POST(buildRequest({ chatSessionId, message: 'John Smith' }));
        await POST(buildRequest({ chatSessionId, message: 'john@example.com' }));
        await POST(buildRequest({ chatSessionId, message: '1990-01-01' }));
        await POST(buildRequest({ chatSessionId, message: 'Str0ngP@ssw0rd!' }));

        const afterDone = await POST(buildRequest({ chatSessionId, message: 'anything else?' }));
        const body = await afterDone.json();

        expect(afterDone.status).toBe(200);
        expect(body.nextStep).toBe('COMPLETE');
        expect(body.sessionActive).toBe(false);
    });

    it('returns 400 with an errors array when chatSessionId/message are missing', async () => {
        const response = await POST(buildRequest({ context: 'x' }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(Array.isArray(body.errors)).toBe(true);
        expect(body.errors.length).toBeGreaterThan(0);
    });
});

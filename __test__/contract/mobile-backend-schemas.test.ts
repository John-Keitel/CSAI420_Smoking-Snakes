/**
 * Contract tests: does the payload this mobile client (mobile/app/api/chatClient.js,
 * mobile/app/lib/stepRules.js — feat/onboarding-chat-ui / PR #66) actually build
 * satisfy the real backend Zod schemas (src/lib/schemas/*.schema.ts, asf0's week5
 * implementation running in production — not Epic 13's unwired LangGraph)?
 *
 * No server, no network: `global.fetch` is mocked to capture the request body
 * chatClient.js sends, and that captured body is parsed against the imported
 * backend schema directly. A drift on either side — client or backend — fails
 * here with the Zod issue list, instead of surfacing later as a live 400.
 *
 * mobile/ is a separate npm project with its own React Native/Expo runtime.
 * Rather than import backend TypeScript into mobile's jest-expo environment
 * (tried first — fails: the transformed .ts file needs @babel/runtime, which
 * only exists in mobile/node_modules, unreachable from src/lib/schemas via
 * upward module resolution), this runs the other way: the mobile client's
 * plain-JS modules are imported directly into this project's Vitest, with its
 * three native-only imports mocked exactly as mobile/jest.setup.js already
 * mocks them for mobile's own Jest suite (same shapes, not reinvented).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// expo-constants and react-native are both redirected via vitest.config.mts's
// resolve.alias, not vi.mock() — see that file and __test__/contract/__mocks__/
// for why (Vite parses/loads the real packages before vi.mock can intercept).

import { ChatAssistedRegistrationSchema } from '@/lib/schemas/chat-assisted-registration.schema';
import { ContinueSessionSchema } from '@/lib/schemas/continue-session.schema';

// eslint-disable-next-line simple-import-sort/imports -- must load after the vi.mock calls above
import { continueSession, registerChatAssisted } from '../../mobile/app/api/chatClient.js';
// eslint-disable-next-line simple-import-sort/imports
import { toUserData } from '../../mobile/app/lib/stepRules.js';

function mockFetchOnce(responseBody: unknown, status = 200) {
    let capturedBody: unknown = null;

    global.fetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
        capturedBody = JSON.parse(String(init?.body));
        return Promise.resolve({
            status,
            json: () => Promise.resolve(responseBody),
        }) as unknown as Promise<Response>;
    }) as typeof fetch;

    return () => capturedBody;
}

function expectValid(schema: { safeParse: (value: unknown) => { success: boolean; error?: { issues: unknown } } }, payload: unknown) {
    const result = schema.safeParse(payload);

    if (!result.success) {
        throw new Error(
            `Payload failed backend schema validation:\n${JSON.stringify(payload, null, 2)}\n\nZod issues:\n${JSON.stringify(result.error?.issues, null, 2)}`
        );
    }
}

describe('contract: mobile client payloads vs. real backend Zod schemas', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('POST /chat/continue-session', () => {
        it('the chat-open payload (ChatSheet mount) satisfies ContinueSessionSchema', async () => {
            const getBody = mockFetchOnce({ response: 'hi', conversationContext: [], nextStep: 'name_provided', sessionActive: true });

            await continueSession({
                chatSessionId: 'contract-test-session-1',
                message: 'I need help signing up',
                context: 'initial_greeting',
            });

            expectValid(ContinueSessionSchema, getBody());
        });

        it('a mid-conversation turn payload satisfies ContinueSessionSchema', async () => {
            const getBody = mockFetchOnce({
                response: 'Thanks! What is your phone number?',
                conversationContext: [],
                nextStep: 'phone_collection',
                sessionActive: true,
            });

            await continueSession({
                chatSessionId: 'contract-test-session-1',
                message: 'jane.doe@example.com',
                context: 'email_collection',
            });

            expectValid(ContinueSessionSchema, getBody());
        });
    });

    describe('POST /user/chat-assisted', () => {
        const collected = {
            name: 'Jane Doe',
            email: 'Jane.Doe@Example.com',
            birthDate: '1990-06-15',
            password: 'Str0ngP@ssw0rd!',
        };

        it('the minimal payload (no phone, no accessibilityMode, no lastActivity) satisfies ChatAssistedRegistrationSchema', () => {
            const payload = {
                userData: toUserData(collected),
                chatSessionId: 'contract-test-session-1',
                conversationLog: [
                    { role: 'assistant', message: "I'd be happy to help! What's your name?" },
                    { role: 'user', message: 'Jane Doe' },
                ],
            };

            expectValid(ChatAssistedRegistrationSchema, payload);
        });

        it('the full payload (phone answered, accessibilityMode + lastActivity present) satisfies ChatAssistedRegistrationSchema', () => {
            const payload = {
                userData: toUserData({ ...collected, phone: '8014567890' }),
                chatSessionId: 'contract-test-session-1',
                conversationLog: [
                    { role: 'assistant', message: "I'd be happy to help! What's your name?" },
                    { role: 'user', message: 'Jane Doe' },
                ],
                lastActivity: new Date().toISOString(),
                accessibilityMode: 'screen-reader',
            };

            expectValid(ChatAssistedRegistrationSchema, payload);
        });
    });

    describe('FND-03: continueSession() response handling', () => {
        // Known, unfixed gap: the real backend (src/app/chat/continue-session/route.ts
        // on main) returns `sessionActive: true` in every 200 response, but chatClient.js's
        // continueSession() never reads that field off the parsed payload. This test
        // documents the gap by asserting the field survives the round trip through the
        // client — it fails today, on purpose, until FND-03 is fixed client-side.
        it('surfaces sessionActive from the backend response (currently dropped by the client)', async () => {
            mockFetchOnce({
                response: 'Great! What is your email address?',
                conversationContext: [{ role: 'user', message: 'Jane Doe' }],
                nextStep: 'email_collection',
                sessionActive: true,
            });

            const result = await continueSession({
                chatSessionId: 'contract-test-session-1',
                message: 'Jane Doe',
                context: 'name_provided',
            });

            expect((result as { sessionActive?: boolean }).sessionActive).toBe(true);
        });
    });
});

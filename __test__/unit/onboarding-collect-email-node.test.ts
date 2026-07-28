import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type NameExtraction = { extractedName: string; looksLikeAValidFullName: boolean };
type EmailExtraction = { extractedEmail: string; looksLikeAValidEmail: boolean };

const DEFAULT_VALID_NAME: NameExtraction = { extractedName: 'John Smith', looksLikeAValidFullName: true };

async function loadGraphModule(options: {
    openAiApiKey?: string;
    nameExtraction?: NameExtraction;
    emailExtraction?: EmailExtraction | 'throw';
}) {
    vi.resetModules();

    const greetingInvokeMock = vi.fn().mockResolvedValue({ content: 'Hi there.' });
    const nameInvokeMock = vi.fn().mockResolvedValue(options.nameExtraction ?? DEFAULT_VALID_NAME);
    const emailInvokeMock =
        options.emailExtraction === 'throw'
            ? vi.fn().mockRejectedValue(new Error('boom'))
            : vi.fn().mockResolvedValue(options.emailExtraction ?? { extractedEmail: '', looksLikeAValidEmail: false });

    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: { OPENAI_API_KEY: options.openAiApiKey, OPENAI_MODEL: 'gpt-4o-mini' },
    }));

    vi.doMock('@langchain/openai', () => {
        class MockChatOpenAI {
            constructor(_config: unknown) {}

            invoke(...args: unknown[]) {
                return greetingInvokeMock(...args);
            }

            withStructuredOutput(schema: { shape?: Record<string, unknown> }) {
                const fields = Object.keys(schema?.shape ?? {});
                if (fields.includes('extractedEmail')) {
                    return { invoke: emailInvokeMock };
                }
                return { invoke: nameInvokeMock };
            }
        }

        return { ChatOpenAI: MockChatOpenAI };
    });

    const { onboardingGraph } = await import('@/lib/onboarding/graph');
    return { onboardingGraph, greetingInvokeMock, nameInvokeMock, emailInvokeMock };
}

/** Runs the graph past GREETING and a valid COLLECT_NAME so it pauses at COLLECT_EMAIL. */
async function advanceToCollectEmail(onboardingGraph: Awaited<ReturnType<typeof loadGraphModule>>['onboardingGraph'], threadConfig: object) {
    await onboardingGraph.invoke({}, threadConfig);
    return onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);
}

describe('collectEmailNode (SCRUM-103)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pauses at COLLECT_EMAIL asking for the email once a valid name is collected', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key' });
        const threadConfig = { configurable: { thread_id: 'scrum-103-pause' } };

        const result = await advanceToCollectEmail(onboardingGraph, threadConfig);

        expect(isInterrupted(result)).toBe(true);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).toBe("What's your email address?");
        }
    });

    it('advances to COLLECT_DOB when the reply is a valid email', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            emailExtraction: { extractedEmail: 'john@example.com', looksLikeAValidEmail: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-103-valid' } };

        await advanceToCollectEmail(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'john@example.com' }), threadConfig);

        // COLLECT_DOB calls interrupt() as of SCRUM-104, so the graph now pauses there
        // instead of completing. See onboarding-collect-dob-node.test.ts for that node's
        // own behavior and the full-cycle smoke test; this just confirms COLLECT_EMAIL advanced.
        expect(isInterrupted(result)).toBe(true);
        expect(result.collectedEmail).toBe('john@example.com');
        expect(result.lastValidationError).toBeNull();
    });

    it('loops back to COLLECT_EMAIL with a re-prompt when the reply is not a plausible email', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            emailExtraction: { extractedEmail: '', looksLikeAValidEmail: false },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-103-invalid' } };

        await advanceToCollectEmail(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'not an email' }), threadConfig);

        expect(result.collectedEmail).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).not.toBe("What's your email address?");
        }
    });

    it('rejects an extraction that fails the Zod guardrail even when the model claims it is valid', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            emailExtraction: { extractedEmail: 'John Smith', looksLikeAValidEmail: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-103-guardrail' } };

        await advanceToCollectEmail(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'my email is my name' }), threadConfig);

        expect(result.collectedEmail).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('falls back to a deterministic re-prompt when the email extraction model call fails', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key', emailExtraction: 'throw' });
        const threadConfig = { configurable: { thread_id: 'scrum-103-model-error' } };

        await advanceToCollectEmail(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'john@example.com' }), threadConfig);

        expect(result.collectedEmail).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });
});

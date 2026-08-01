import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadGraphModule(options: {
    openAiApiKey?: string;
    greetingContent?: string;
    nameExtraction?: { extractedName: string; looksLikeAValidFullName: boolean } | 'throw';
}) {
    vi.resetModules();

    const greetingInvokeMock = vi.fn().mockResolvedValue({ content: options.greetingContent ?? 'Hi there.' });
    const nameInvokeMock =
        options.nameExtraction === 'throw'
            ? vi.fn().mockRejectedValue(new Error('boom'))
            : vi.fn().mockResolvedValue(options.nameExtraction ?? { extractedName: '', looksLikeAValidFullName: false });

    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: { OPENAI_API_KEY: options.openAiApiKey, OPENAI_MODEL: 'gpt-4o-mini' },
    }));

    vi.doMock('@langchain/openai', () => {
        class MockChatOpenAI {
            constructor(_config: unknown) {}

            invoke(...args: unknown[]) {
                return greetingInvokeMock(...args);
            }

            withStructuredOutput() {
                return { invoke: nameInvokeMock };
            }
        }

        return { ChatOpenAI: MockChatOpenAI };
    });

    const { onboardingGraph } = await import('@/lib/onboarding/graph');
    return { onboardingGraph, greetingInvokeMock, nameInvokeMock };
}

describe('collectNameNode (SCRUM-102)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pauses at COLLECT_NAME asking for the name after GREETING runs', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key' });

        const result = await onboardingGraph.invoke({}, { configurable: { thread_id: 'scrum-102-pause' } });

        expect(isInterrupted(result)).toBe(true);
        expect(result.messages).toHaveLength(1);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).toBe("What's your full name?");
        }
    });

    it('advances to COLLECT_EMAIL when the reply is a valid full name', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            nameExtraction: { extractedName: 'John Smith', looksLikeAValidFullName: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-102-valid' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);

        // COLLECT_EMAIL calls interrupt() as of SCRUM-103, so the graph now pauses there
        // instead of running through to COLLECT_DOB. See onboarding-collect-email-node.test.ts
        // for that node's own behavior; this just confirms COLLECT_NAME itself advanced.
        expect(isInterrupted(result)).toBe(true);
        expect(result.collectedName).toBe('John Smith');
        expect(result.lastValidationError).toBeNull();
    });

    it('loops back to COLLECT_NAME with a re-prompt when the reply is not a plausible name', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            nameExtraction: { extractedName: '', looksLikeAValidFullName: false },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-102-invalid' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'asdf 123' }), threadConfig);

        expect(result.collectedName).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).not.toBe("What's your full name?");
        }
    });

    it('rejects an extraction that fails the Zod guardrail even when the model claims it is valid', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            nameExtraction: { extractedName: 'not-a-name@example.com', looksLikeAValidFullName: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-102-guardrail' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'give me an email instead' }), threadConfig);

        expect(result.collectedName).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('validates the raw reply against the guardrail schema when OPENAI_API_KEY is unset', async () => {
        const { onboardingGraph, nameInvokeMock } = await loadGraphModule({ openAiApiKey: undefined });
        const threadConfig = { configurable: { thread_id: 'scrum-102-fallback-valid' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);

        // No model to call, but a plausible name should still advance instead of
        // looping forever (SCRUM-106) — COLLECT_EMAIL then pauses for its own reply.
        expect(nameInvokeMock).not.toHaveBeenCalled();
        expect(result.collectedName).toBe('John Smith');
        expect(result.lastValidationError).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('re-prompts when OPENAI_API_KEY is unset and the raw reply also fails the guardrail schema', async () => {
        const { onboardingGraph, nameInvokeMock } = await loadGraphModule({ openAiApiKey: undefined });
        const threadConfig = { configurable: { thread_id: 'scrum-102-fallback-invalid' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'asdf 123' }), threadConfig);

        expect(nameInvokeMock).not.toHaveBeenCalled();
        expect(result.collectedName).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
    });

    it('validates the raw reply against the guardrail schema when the model call fails', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key', nameExtraction: 'throw' });
        const threadConfig = { configurable: { thread_id: 'scrum-102-model-error-valid' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);

        expect(result.collectedName).toBe('John Smith');
        expect(result.lastValidationError).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('re-prompts when the model call fails and the raw reply also fails the guardrail schema', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key', nameExtraction: 'throw' });
        const threadConfig = { configurable: { thread_id: 'scrum-102-model-error-invalid' } };

        await onboardingGraph.invoke({}, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'asdf 123' }), threadConfig);

        expect(result.collectedName).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
    });

    it('abandons the flow after 3 consecutive failed attempts instead of looping forever', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            nameExtraction: { extractedName: '', looksLikeAValidFullName: false },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-102-abandon' } };

        await onboardingGraph.invoke({}, threadConfig);
        await onboardingGraph.invoke(new Command({ resume: 'asdf 123' }), threadConfig);
        await onboardingGraph.invoke(new Command({ resume: 'asdf 123' }), threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'asdf 123' }), threadConfig);

        expect(isInterrupted(result)).toBe(false);
        expect(result.step).toBe('ABANDONED');
        expect(result.collectedName).toBeNull();
        expect(result.messages[result.messages.length - 1]?.content).toBeTruthy();
    });
});

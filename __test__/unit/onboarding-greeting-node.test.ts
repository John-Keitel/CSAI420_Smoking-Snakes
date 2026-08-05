import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadGreetingModule(options: { openAiApiKey?: string; content?: string; shouldThrow?: boolean }) {
    vi.resetModules();

    const invokeMock = options.shouldThrow
        ? vi.fn().mockRejectedValue(new Error('boom'))
        : vi.fn().mockResolvedValue({ content: options.content ?? 'Mock greeting text.' });

    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: { OPENAI_API_KEY: options.openAiApiKey, OPENAI_MODEL: 'gpt-4o-mini' },
    }));

    vi.doMock('@langchain/openai', () => {
        class MockChatOpenAI {
            constructor(_config: unknown) {}

            invoke(...args: unknown[]) {
                return invokeMock(...args);
            }
        }

        return { ChatOpenAI: MockChatOpenAI };
    });

    const nodeModule = await import('@/lib/onboarding/nodes/greeting');
    return { nodeModule, invokeMock };
}

describe('greetingNode (SCRUM-101)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('produces an intro message from the model when OPENAI_API_KEY is configured', async () => {
        const { nodeModule, invokeMock } = await loadGreetingModule({
            openAiApiKey: 'test-key',
            content: 'Welcome! Let us get you set up in a few quick steps.',
        });

        const result = await nodeModule.greetingNode({} as never);

        expect(invokeMock).toHaveBeenCalledOnce();
        expect(result.step).toBe('GREETING');
        expect(result.messages).toHaveLength(1);
        expect(result.messages?.[0].content).toBe('Welcome! Let us get you set up in a few quick steps.');
    });

    it('falls back to a static greeting when OPENAI_API_KEY is unset', async () => {
        const { nodeModule, invokeMock } = await loadGreetingModule({ openAiApiKey: undefined });

        const result = await nodeModule.greetingNode({} as never);

        expect(invokeMock).not.toHaveBeenCalled();
        expect(result.step).toBe('GREETING');
        expect(result.messages).toHaveLength(1);
        expect(typeof result.messages?.[0].content).toBe('string');
        expect((result.messages?.[0].content as string).length).toBeGreaterThan(0);
    });

    it('falls back to a static greeting when the model call fails', async () => {
        const { nodeModule, invokeMock } = await loadGreetingModule({ openAiApiKey: 'test-key', shouldThrow: true });

        const result = await nodeModule.greetingNode({} as never);

        expect(invokeMock).toHaveBeenCalledOnce();
        expect(result.step).toBe('GREETING');
        expect(result.messages).toHaveLength(1);
    });
});

describe('onboarding graph GREETING wiring (SCRUM-101)', () => {
    it('transitions unconditionally from GREETING to COLLECT_NAME', async () => {
        vi.resetModules();
        vi.doMock('@/lib/env-vars', () => ({
            ENV_VARS: { OPENAI_API_KEY: undefined, OPENAI_MODEL: 'gpt-4o-mini' },
        }));

        const { onboardingGraph } = await import('@/lib/onboarding/graph');

        const edges = Array.from(onboardingGraph.builder.edges);
        const hasGreetingToCollectName = edges.some(([from, to]) => from === 'GREETING' && to === 'COLLECT_NAME');
        expect(hasGreetingToCollectName).toBe(true);

        // COLLECT_NAME/EMAIL/DOB are still stubs (real guardrail + interrupt() logic lands in
        // SCRUM-102–104), so a full invoke currently runs straight through to COLLECT_DOB.
        // This just confirms GREETING actually ran and produced its one message along the way.
        const result = await onboardingGraph.invoke({}, { configurable: { thread_id: 'scrum-101-unit-test' } });
        expect(result.messages).toHaveLength(1);

        vi.doUnmock('@/lib/env-vars');
        vi.resetModules();
    });
});

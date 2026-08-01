import { START } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ONBOARDING_NODES = ['GREETING', 'COLLECT_NAME', 'COLLECT_EMAIL', 'COLLECT_DOB'];

function mockEnvVarsWithoutOpenAiKey() {
    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: { OPENAI_API_KEY: undefined, OPENAI_MODEL: 'gpt-4o-mini' },
    }));
}

describe('onboarding LangGraph setup (SCRUM-100)', () => {
    beforeEach(() => {
        vi.resetModules();
        mockEnvVarsWithoutOpenAiKey();
    });

    it('compiles a StateGraph with the four onboarding nodes registered', async () => {
        const { onboardingGraph } = await import('@/lib/onboarding/graph');

        expect(Object.keys(onboardingGraph.builder.nodes).sort()).toEqual([...ONBOARDING_NODES].sort());
    });

    it('wires START to GREETING', async () => {
        const { onboardingGraph } = await import('@/lib/onboarding/graph');

        const edges = Array.from(onboardingGraph.builder.edges);
        const hasStartToGreeting = edges.some(([from, to]) => from === START && to === 'GREETING');

        expect(hasStartToGreeting).toBe(true);
    });

    it('runs the stub chain end-to-end from GREETING to COLLECT_DOB', async () => {
        const { onboardingGraph } = await import('@/lib/onboarding/graph');

        const result = await onboardingGraph.invoke({}, { configurable: { thread_id: 'scrum-100-unit-test' } });

        expect(result.step).toBe('COLLECT_DOB');
    });

    it('does not throw at import time when OPENAI_API_KEY is unset', async () => {
        await expect(import('@/lib/onboarding')).resolves.toBeDefined();

        const { getOnboardingModel } = await import('@/lib/onboarding/model');
        expect(getOnboardingModel()).toBeNull();
    });
});

import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';

import { greetingNode } from '@/lib/onboarding/nodes/greeting';
import { OnboardingStateAnnotation, type OnboardingState, type OnboardingStep } from '@/lib/onboarding/state';

/**
 * Placeholder node body for SCRUM-102–104, which each replace one of these
 * with real prompt/extraction/guardrail logic (see design.md § Node contract).
 */
function createStubNode(step: OnboardingStep) {
    return async (): Promise<Partial<OnboardingState>> => ({ step });
}

const builder = new StateGraph(OnboardingStateAnnotation)
    .addNode('GREETING', greetingNode)
    .addNode('COLLECT_NAME', createStubNode('COLLECT_NAME'))
    .addNode('COLLECT_EMAIL', createStubNode('COLLECT_EMAIL'))
    .addNode('COLLECT_DOB', createStubNode('COLLECT_DOB'))
    .addEdge(START, 'GREETING')
    .addEdge('GREETING', 'COLLECT_NAME')
    .addEdge('COLLECT_NAME', 'COLLECT_EMAIL')
    .addEdge('COLLECT_EMAIL', 'COLLECT_DOB')
    .addEdge('COLLECT_DOB', END);

/**
 * MemorySaver is in-process only and does not survive across serverless
 * invocations on Vercel. Fine for compiling/testing the graph in isolation
 * (this slice); must become a durable checkpointer before any route exposes
 * this graph to real users (see design.md § Known gap).
 */
export const onboardingGraph = builder.compile({ checkpointer: new MemorySaver() });

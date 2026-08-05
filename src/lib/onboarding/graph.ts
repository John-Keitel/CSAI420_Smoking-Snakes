import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';

import { collectNameNode } from '@/lib/onboarding/nodes/collect-name';
import { greetingNode } from '@/lib/onboarding/nodes/greeting';
import { type OnboardingState, OnboardingStateAnnotation, type OnboardingStep } from '@/lib/onboarding/state';

/**
 * Placeholder node body for SCRUM-103–104, which each replace one of these
 * with real prompt/extraction/guardrail logic (see design.md § Node contract).
 */
function createStubNode(step: OnboardingStep) {
    return async (): Promise<Partial<OnboardingState>> => ({ step });
}

/** Max re-prompt attempts before giving up on collecting the name. */
const MAX_NAME_ATTEMPTS = 3;

/**
 * SCRUM-102: advance once a name has been collected, otherwise loop back for a
 * retry. Exits to END after MAX_NAME_ATTEMPTS so a degraded path (e.g. missing
 * OPENAI_API_KEY) cannot loop forever against LangGraph's recursion limit.
 */
function routeAfterCollectName(state: OnboardingState): 'COLLECT_EMAIL' | 'COLLECT_NAME' | typeof END {
    if (state.collectedName) {
        return 'COLLECT_EMAIL';
    }

    return state.nameAttempts >= MAX_NAME_ATTEMPTS ? END : 'COLLECT_NAME';
}

const builder = new StateGraph(OnboardingStateAnnotation)
    .addNode('GREETING', greetingNode)
    .addNode('COLLECT_NAME', collectNameNode)
    .addNode('COLLECT_EMAIL', createStubNode('COLLECT_EMAIL'))
    .addNode('COLLECT_DOB', createStubNode('COLLECT_DOB'))
    .addEdge(START, 'GREETING')
    .addEdge('GREETING', 'COLLECT_NAME')
    .addConditionalEdges('COLLECT_NAME', routeAfterCollectName)
    .addEdge('COLLECT_EMAIL', 'COLLECT_DOB')
    .addEdge('COLLECT_DOB', END);

/**
 * MemorySaver is in-process only and does not survive across serverless
 * invocations on Vercel. Fine for compiling/testing the graph in isolation
 * (this slice); must become a durable checkpointer before any route exposes
 * this graph to real users (see design.md § Known gap).
 */
export const onboardingGraph = builder.compile({ checkpointer: new MemorySaver() });

import { END, MemorySaver, START, StateGraph } from '@langchain/langgraph';

import { collectDobNode } from '@/lib/onboarding/nodes/collect-dob';
import { collectEmailNode } from '@/lib/onboarding/nodes/collect-email';
import { collectNameNode } from '@/lib/onboarding/nodes/collect-name';
import { greetingNode } from '@/lib/onboarding/nodes/greeting';
import { OnboardingStateAnnotation, type OnboardingState } from '@/lib/onboarding/state';

/** SCRUM-102: advance once a name has been collected, otherwise loop back for a retry. */
function routeAfterCollectName(state: OnboardingState): 'COLLECT_EMAIL' | 'COLLECT_NAME' {
    return state.collectedName ? 'COLLECT_EMAIL' : 'COLLECT_NAME';
}

/** SCRUM-103: advance once an email has been collected, otherwise loop back for a retry. */
function routeAfterCollectEmail(state: OnboardingState): 'COLLECT_DOB' | 'COLLECT_EMAIL' {
    return state.collectedEmail ? 'COLLECT_DOB' : 'COLLECT_EMAIL';
}

/**
 * SCRUM-104: advance to the END placeholder once a DOB has been collected,
 * otherwise loop back for a retry. See design.md § State transitions — END
 * here is a named placeholder, not a real "onboarding complete" state; a
 * future ticket replaces it with COLLECT_PASSWORD.
 */
function routeAfterCollectDob(state: OnboardingState): typeof END | 'COLLECT_DOB' {
    return state.collectedDob ? END : 'COLLECT_DOB';
}

const builder = new StateGraph(OnboardingStateAnnotation)
    .addNode('GREETING', greetingNode)
    .addNode('COLLECT_NAME', collectNameNode)
    .addNode('COLLECT_EMAIL', collectEmailNode)
    .addNode('COLLECT_DOB', collectDobNode)
    .addEdge(START, 'GREETING')
    .addEdge('GREETING', 'COLLECT_NAME')
    .addConditionalEdges('COLLECT_NAME', routeAfterCollectName)
    .addConditionalEdges('COLLECT_EMAIL', routeAfterCollectEmail)
    .addConditionalEdges('COLLECT_DOB', routeAfterCollectDob);

/**
 * MemorySaver is in-process only and does not survive across serverless
 * invocations on Vercel. Fine for compiling/testing the graph in isolation
 * (this slice); must become a durable checkpointer before any route exposes
 * this graph to real users (see design.md § Known gap).
 */
export const onboardingGraph = builder.compile({ checkpointer: new MemorySaver() });

import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';

import { onboardingGraph } from '@/lib/onboarding';
import { appendConversationTurns, getConversationTranscript, type ConversationTurn } from '@/lib/chat-continuation/transcript';

export type ContinueSessionResult = {
    response: string;
    conversationContext: ConversationTurn[];
    nextStep: string;
    sessionActive: boolean;
};

const FALLBACK_ASSISTANT_TEXT = "Let's continue with your sign-up.";

// collect-password.ts's success path (src/lib/onboarding/nodes/collect-password.ts) only sets
// `step: 'COMPLETE'` and `collectedPasswordHash` — it never adds a message to OnboardingState's
// `messages` channel. That's a real gap in the graph itself (see design.md's "Known gap"), not
// something to route around silently: this is what the caller sees instead once the
// conversation actually finishes, since the graph has nothing to say at that point.
const COMPLETION_MESSAGE = "Thanks! I've got everything I need — your account details are ready.";

function threadConfig(chatSessionId: string) {
    return { configurable: { thread_id: chatSessionId } };
}

function extractInterruptQuestion(result: unknown): string | null {
    if (!isInterrupted<{ question: string }>(result)) {
        return null;
    }
    return result[INTERRUPT][0]?.value?.question ?? null;
}

function lastMessageText(messages: ReadonlyArray<{ content: unknown }> | undefined): string | null {
    const last = messages?.[messages.length - 1];
    return typeof last?.content === 'string' && last.content.length > 0 ? last.content : null;
}

/**
 * Drives one turn of the onboarding LangGraph (src/lib/onboarding/graph.ts) for a chat session,
 * using chatSessionId as the graph's thread_id and message as the interrupt() resume value —
 * built on top of Epic 13's existing conversational engine rather than re-implementing
 * ask/validate/loop here.
 *
 * KNOWN GAP (inherited from src/lib/onboarding/graph.ts, unchanged by this endpoint): the graph
 * is compiled with `MemorySaver`, an in-process-memory checkpointer. It does NOT survive a
 * process restart/redeploy and does NOT work correctly across more than one running instance —
 * a mid-conversation session can silently reset to GREETING if the process restarts or a
 * different instance handles the next request. This is acceptable for now per explicit
 * instruction, but a durable checkpointer (e.g. Postgres-backed, against the existing
 * DATABASE_URL) is required before this route carries real production traffic.
 */
export async function continueOnboardingChatSession(chatSessionId: string, message: string): Promise<ContinueSessionResult> {
    const config = threadConfig(chatSessionId);

    // A never-invoked thread_id has an empty `values` object; any thread that has been invoked
    // before — whether currently paused or already terminal (COMPLETE/ABANDONED) — has its
    // OnboardingState fields populated. Checking `values` (not just `next.length === 0`, which
    // is also true once terminal) is what lets a brand-new session and an already-finished one
    // be told apart, so a finished session doesn't get re-invoked and re-run GREETING.
    const priorState = await onboardingGraph.getState(config);
    const isNewSession = Object.keys(priorState.values).length === 0;
    const alreadyFinished = !isNewSession && priorState.next.length === 0;

    const result = alreadyFinished
        ? priorState.values
        : isNewSession
          ? await onboardingGraph.invoke({}, config)
          : await onboardingGraph.invoke(new Command({ resume: message }), config);

    const interrupted = !alreadyFinished && isInterrupted(result);

    // The interrupt's `question` (see e.g. collect-name.ts's `interrupt({ question })`) is the
    // thing currently being asked and is what a caller should show next — it is NOT part of
    // OnboardingState.messages (only some nodes append there, e.g. re-prompts/redirects/the
    // abandon message; see each node's rePromptOrAbandon vs. its silent success path).
    const assistantText = interrupted
        ? (extractInterruptQuestion(result) ?? FALLBACK_ASSISTANT_TEXT)
        : result.step === 'COMPLETE'
          ? COMPLETION_MESSAGE
          : (lastMessageText(result.messages) ?? FALLBACK_ASSISTANT_TEXT);

    // `result.step` (from the invoke() return) reflects the last node that RAN TO COMPLETION,
    // labeled by its own name (e.g. still 'COLLECT_NAME' right after it succeeds and the graph
    // has already moved on to pause at COLLECT_EMAIL) — it lags one step behind while paused.
    // `getState().next` is the authoritative "what's paused/about to run" signal instead, and is
    // always non-empty here: the graph only ever pauses at exactly one interrupting node.
    const nextStep = interrupted ? (await onboardingGraph.getState(config)).next[0]! : result.step;

    // Nothing new happened this turn if the session was already finished before this call —
    // the transcript is returned as-is rather than appending another round the graph never saw.
    const conversationContext = alreadyFinished
        ? getConversationTranscript(chatSessionId)
        : appendConversationTurns(chatSessionId, [
              { role: 'user', message },
              { role: 'assistant', message: assistantText },
          ]);

    return {
        response: assistantText,
        conversationContext,
        nextStep,
        sessionActive: interrupted,
    };
}

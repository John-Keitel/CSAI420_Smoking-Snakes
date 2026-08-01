export type ConversationTurn = {
    role: 'user' | 'assistant';
    message: string;
};

// Process-memory only — same durability caveat as the onboarding graph's MemorySaver
// checkpointer (src/lib/onboarding/graph.ts): does NOT survive a process restart or run
// correctly across more than one server instance. This exists only to build the
// `conversationContext` response field (the graph's own OnboardingState.messages channel only
// ever accumulates a subset of assistant messages, never the user's replies — see
// src/lib/chat-continuation/session.ts's comment on extractAssistantText). It must move to a
// durable, shared store (e.g. Postgres via DATABASE_URL, alongside a durable checkpointer)
// before this route serves real production traffic.
const transcripts = new Map<string, ConversationTurn[]>();

export function appendConversationTurns(chatSessionId: string, turns: ConversationTurn[]): ConversationTurn[] {
    const existing = transcripts.get(chatSessionId) ?? [];
    const updated = [...existing, ...turns];
    transcripts.set(chatSessionId, updated);
    return updated;
}

export function getConversationTranscript(chatSessionId: string): ConversationTurn[] {
    return transcripts.get(chatSessionId) ?? [];
}

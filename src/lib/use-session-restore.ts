'use client';

const STORAGE_KEY = 'stedi-chat-session';

const SESSION_TTL_MS = 30 * 60 * 1000;

type ChatStep =
    | 'initial_greeting'
    | 'name_provided'
    | 'email_collection'
    | 'phone_collection'
    | 'birth_date_collection'
    | 'password_collection'
    | 'completion';

type ChatMessage = { role: 'assistant' | 'user'; message: string };

type CollectedFields = {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    birthDate?: string;
    password?: string;
};

export type PersistedChatState = {
    messages: ChatMessage[];
    currentStep: ChatStep;
    collected: CollectedFields;
    chatSessionId: string;
    savedAt: number;
};

/**
 * Strips the password before persistence (WEBRESTORE-03). The credential must
 * never be written to sessionStorage at rest.
 */
function stripPassword(collected: CollectedFields): CollectedFields {
    const { password, ...rest } = collected;
    void password;
    return rest;
}

/**
 * Saves the chat state to sessionStorage, excluding the password (WEBRESTORE-01).
 * Never persists a completed session.
 */
export function saveSession(state: Omit<PersistedChatState, 'savedAt'>): void {
    if (state.currentStep === 'completion') {
        return;
    }

    try {
        const payload: PersistedChatState = {
            ...state,
            collected: stripPassword(state.collected),
            savedAt: Date.now(),
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // sessionStorage disabled/corrupt: non-fatal; fall back to fresh session.
    }
}

/**
 * Loads and validates a persisted session. Returns null for absent, corrupt,
 * or expired data (WEBRESTORE-02, WEBRESTORE-05).
 */
export function loadSession(): PersistedChatState | null {
    try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as PersistedChatState;
        if (!parsed || !parsed.currentStep || !Array.isArray(parsed.messages)) return null;

        if (Date.now() - (parsed.savedAt ?? 0) > SESSION_TTL_MS) {
            clearSession();
            return null;
        }

        return parsed;
    } catch {
        clearSession();
        return null;
    }
}

/**
 * Removes the persisted session (WEBRESTORE-04). Called after successful
 * registration.
 */
export function clearSession(): void {
    try {
        sessionStorage.removeItem(STORAGE_KEY);
    } catch {
        // Idempotent.
    }
}

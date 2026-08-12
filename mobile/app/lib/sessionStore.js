import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Persists the chat session so a minimized/backgrounded app restores where the
 * user left off instead of dropping the conversation (RESTORE-01 → RESTORE-05).
 *
 * The password is NEVER persisted (RESTORE-04): the credential handling risk
 * flagged in the v1 design is resolved by stripping `collected.password`
 * before writing. On restore at the password step the user is re-prompted.
 *
 * Storage is debounced on `AppState` background in `ChatSheet`; this module is
 * the pure read/strip/write/clear layer with no React dependencies.
 */

const STORAGE_KEY = '@stedi/chat-session';

/** 30 minutes — matches CHAT_SESSION_TIMEOUT_MS on the server. */
export const SESSION_TTL_MS = 30 * 60 * 1000;

/**
 * Strips the password from the persisted blob. The credential must never
 * be written to AsyncStorage at rest (RESTORE-04).
 *
 * @param {{collected: object, [key: string]: unknown}} state
 * @returns {object} A copy with collected.password removed.
 */
function stripPassword(state) {
    if (!state || typeof state !== 'object') {
        return state;
    }

    const { password, ...restCollected } = state.collected ?? {};

    return { ...state, collected: restCollected };
}

/**
 * Saves the chat session to AsyncStorage, excluding the password (RESTORE-01).
 *
 * @param {object} state - The ChatSheet session state.
 * @returns {Promise<void>}
 */
export async function save(state) {
    const safe = stripPassword(state);

    // Never persist a completed session — clearing happens on completion, but
    // a late save racing the clear would resurrect a finished conversation.
    if (safe.currentStep === 'completion') {
        return;
    }

    const payload = {
        ...safe,
        savedAt: Date.now(),
    };

    try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
        // AsyncStorage failure is non-fatal: the app falls back to a fresh
        // session on next open rather than crashing. Logged out of band.
    }
}

/**
 * Loads and validates a persisted session.
 *
 * Returns `null` for absent, corrupt, or expired data so the caller always
 * gets a clean decision: resume or start fresh (RESTORE-02, RESTORE-03).
 *
 * @param {number} [ttlMs] - Override for tests; defaults to SESSION_TTL_MS.
 * @returns {Promise<object|null>}
 */
export async function load(ttlMs = SESSION_TTL_MS) {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);

        if (!parsed || typeof parsed !== 'object' || !parsed.currentStep) {
            return null;
        }

        if (isExpired(parsed.savedAt, ttlMs)) {
            await clear();
            return null;
        }

        return parsed;
    } catch {
        // Corrupt JSON or AsyncStorage failure: discard and start fresh.
        await clear();
        return null;
    }
}

/**
 * Removes the persisted session (RESTORE-05). Called after successful
 * registration and when an expired session is detected.
 *
 * @returns {Promise<void>}
 */
export async function clear() {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {
        // Idempotent: a failed clear is the same as nothing stored.
    }
}

/**
 * Returns whether a savedAt timestamp is older than the TTL (RESTORE-03).
 *
 * @param {number} savedAt - Epoch milliseconds from `Date.now()` at save time.
 * @param {number} [ttlMs] - Override for tests.
 * @returns {boolean}
 */
export function isExpired(savedAt, ttlMs = SESSION_TTL_MS) {
    if (typeof savedAt !== 'number' || Number.isNaN(savedAt)) {
        return true;
    }

    return Date.now() - savedAt > ttlMs;
}

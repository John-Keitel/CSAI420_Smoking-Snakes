import * as Crypto from 'expo-crypto';

/** The API rejects a `chatSessionId` longer than this (ChatAssistedRegistrationSchema). */
export const MAX_CHAT_SESSION_ID_LENGTH = 128;

/**
 * Mints the correlation id for one chat registration session.
 *
 * The server does not generate this - `getOrCreateChatSession` upserts on whatever
 * the client sends - so the client owns it.
 *
 * @returns {string} A fresh session id, at most MAX_CHAT_SESSION_ID_LENGTH characters.
 */
export function createChatSessionId() {
    return Crypto.randomUUID().slice(0, MAX_CHAT_SESSION_ID_LENGTH);
}

// 30 minutes — matches chatTestHelpers.js's testConstants.TIMEOUTS.CHAT_SESSION in the grading
// integration tests.
export const CHAT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Whether a chat session should be treated as expired based on its last-activity timestamp.
 * Returns false (not expired) for anything that isn't a parseable timestamp, so a malformed or
 * absent `lastActivity` never blocks registration on its own — only used as a positive signal.
 */
export function isChatSessionExpired(lastActivity: unknown): boolean {
    if (typeof lastActivity !== 'string') {
        return false;
    }

    const elapsedMs = Date.now() - new Date(lastActivity).getTime();
    if (Number.isNaN(elapsedMs)) {
        return false;
    }

    return elapsedMs >= CHAT_SESSION_TIMEOUT_MS;
}

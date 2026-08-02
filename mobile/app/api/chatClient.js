import Constants from 'expo-constants';

// These routes live outside src/app/api/, so neither path carries an /api prefix.
const CONTINUE_SESSION_PATH = '/chat/continue-session';
const CHAT_ASSISTED_PATH = '/user/chat-assisted';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

/**
 * Resolves the API host from Expo config.
 *
 * Throws rather than returning a default: a build with no `extra.apiBaseUrl`
 * would otherwise request `undefined/chat/continue-session` and fail as a
 * confusing 404 far from its cause.
 *
 * @returns {string} Base URL with any trailing slashes removed.
 */
export function getApiBaseUrl() {
    const configured = Constants?.expoConfig?.extra?.apiBaseUrl;

    if (typeof configured !== 'string' || configured.trim().length === 0) {
        throw new Error('apiBaseUrl is not configured. Set expo.extra.apiBaseUrl in mobile/app.json.');
    }

    return configured.trim().replace(/\/+$/, '');
}

async function postJson(path, body) {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => null);

    return { status: response.status, payload };
}

/**
 * Advances the conversation by one turn.
 *
 * @param {{chatSessionId: string, message: string, context?: string}} input
 * @returns {Promise<object>} `{ok:true, response, conversationContext, nextStep}`
 *   on 200, `{ok:false, kind:'invalid', errors}` on 400, otherwise
 *   `{ok:false, kind:'failed', status}`.
 */
export async function continueSession({ chatSessionId, message, context }) {
    const body = { chatSessionId, message };

    if (context) {
        body.context = context;
    }

    try {
        const { status, payload } = await postJson(CONTINUE_SESSION_PATH, body);

        if (status === 200 && payload) {
            return {
                ok: true,
                response: payload.response,
                conversationContext: Array.isArray(payload.conversationContext) ? payload.conversationContext : [],
                nextStep: payload.nextStep,
            };
        }

        if (status === 400) {
            return { ok: false, kind: 'invalid', errors: payload?.errors ?? [] };
        }

        return { ok: false, kind: 'failed', status };
    } catch {
        return { ok: false, kind: 'failed', status: null };
    }
}

/**
 * Creates the account once the conversation reaches `completion`.
 *
 * Expected statuses are returned as discriminated outcomes rather than thrown:
 * the UI has to branch on 409 (retry the email), 408 (session expired) and 400
 * (show field errors) separately, and exceptions would flatten them together.
 *
 * @param {object} input Payload for POST /user/chat-assisted.
 * @returns {Promise<object>} `{ok:true, user}` on 201, otherwise `{ok:false, kind, ...}`
 *   where kind is 'invalid' | 'expired' | 'duplicate' | 'failed'.
 */
export async function registerChatAssisted(input) {
    try {
        const { status, payload } = await postJson(CHAT_ASSISTED_PATH, input);

        if (status === 201 && payload) {
            return { ok: true, user: payload.user, message: payload.message };
        }

        if (status === 400) {
            return { ok: false, kind: 'invalid', errors: payload?.errors ?? [] };
        }

        if (status === 408) {
            return { ok: false, kind: 'expired', message: payload?.message ?? 'Chat session has expired' };
        }

        if (status === 409) {
            return { ok: false, kind: 'duplicate', message: payload?.error ?? 'Email already registered' };
        }

        return { ok: false, kind: 'failed', status };
    } catch {
        return { ok: false, kind: 'failed', status: null };
    }
}

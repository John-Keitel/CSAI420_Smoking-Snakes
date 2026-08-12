import * as Speech from 'expo-speech';

/**
 * TTS controller for assistant replies (VOICE-01 → VOICE-04).
 *
 * Wraps `expo-speech` behind a small surface so:
 *  - support is checked once and cached (VOICE-03 — the affordance is hidden
 *    entirely when TTS is unavailable, rather than failing at runtime);
 *  - re-speaking halts any in-flight utterance first, so turns never overlap;
 *  - `stop()` is idempotent and safe to call from an unmount cleanup.
 *
 * The module is a singleton: one TTS stream per app. `ChatSheet` owns the one
 * instance and calls `stop()` on dismiss/unmount so a reply started in a
 * dismissed sheet does not keep talking over the next session.
 */

let supportCache = null;

/**
 * Resolves whether the device can synthesize speech.
 *
 * `getAvailableVoicesAsync()` throws an `UnavailabilityError` on devices where
 * the native module is absent, so the check is try/catch'd and cached for the
 * life of the app rather than re-evaluated per render (VOICE-03).
 *
 * @returns {Promise<boolean>}
 */
export async function isSupported() {
    if (supportCache !== null) {
        return supportCache;
    }

    try {
        const voices = await Speech.getAvailableVoicesAsync();
        supportCache = Array.isArray(voices) && voices.length > 0;
    } catch {
        supportCache = false;
    }

    return supportCache;
}

/**
 * Forces the support cache back to unknown. Exposed for tests that need to
 * flip the cached state between cases without re-importing the module.
 */
export function _resetSupportCache() {
    supportCache = null;
}

let speaking = false;

/**
 * @returns {boolean} Whether an utterance started by this controller is live.
 */
export function isSpeaking() {
    return speaking;
}

/**
 * Synthesizes `text`. Any in-flight utterance is stopped first so turns never
 * overlap (VOICE-01). Resolves when speech starts, not when it finishes — the
 * optional callbacks are the only signal for completion.
 *
 * @param {string} text
 * @param {{onDone?: Function, onStopped?: Function, onError?: Function}} [callbacks]
 * @returns {Promise<void>}
 */
export async function speak(text, callbacks = {}) {
    if (!text || typeof text !== 'string' || text.length === 0) {
        return;
    }

    // Re-speaking halts whatever is playing so the user never hears two
    // replies at once.
    await stop();

    speaking = true;

    const settle = (fn) => () => {
        speaking = false;
        fn?.();
    };

    Speech.speak(text, {
        onStart: undefined,
        onDone: settle(callbacks.onDone),
        onStopped: settle(callbacks.onStopped),
        onError: settle(callbacks.onError),
    });
}

/**
 * Halts the current utterance. Idempotent: safe to call when nothing is
 * playing and from an unmount cleanup (edge case: TTS interrupted by
 * navigation).
 *
 * @returns {Promise<void>}
 */
export async function stop() {
    try {
        await Speech.stop();
    } catch {
        // `stop` can reject if nothing is queued on some native modules; an
        // idempotent stop never throws into the caller.
    }

    speaking = false;
}
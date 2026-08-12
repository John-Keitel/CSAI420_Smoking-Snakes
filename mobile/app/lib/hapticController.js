import * as Haptics from 'expo-haptics';

/**
 * Haptic feedback controller for send/error moments (HAPTIC-01, HAPTIC-02).
 *
 * Unlike expo-speech, expo-haptics has no side-effect-free "is this
 * supported" query - every real function fires actual hardware feedback, so
 * there is no probe to run silently up front the way voiceController.js's
 * isSupported() does. Support here is instead learned from whether the
 * first real attempt succeeds, then cached so a device with no haptics
 * engine stops paying for failed bridge calls on every subsequent turn.
 */

let supportCache = null;

async function attempt(run) {
    if (supportCache === false) {
        return;
    }

    try {
        await run();
        supportCache = true;
    } catch {
        // UnavailabilityError on devices/simulators with no haptics engine;
        // treated as a permanent "don't bother again" for this session.
        supportCache = false;
    }
}

/**
 * Whether haptics are known to work. Optimistic (`true`) until a real
 * attempt has failed at least once - unlike voiceController's isSupported(),
 * this cannot be known for certain without triggering real hardware
 * feedback, so it is not itself async and does not probe anything.
 *
 * @returns {boolean}
 */
export function isSupported() {
    return supportCache !== false;
}

/**
 * Forces the support cache back to unknown. Exposed for tests that need to
 * flip the cached state between cases without re-importing the module.
 */
export function _resetSupportCache() {
    supportCache = null;
}

/** A short, light tap confirming a message was sent (HAPTIC-01). */
export function messageSent() {
    return attempt(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** The platform's error notification pattern (HAPTIC-02). */
export function errorOccurred() {
    return attempt(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}

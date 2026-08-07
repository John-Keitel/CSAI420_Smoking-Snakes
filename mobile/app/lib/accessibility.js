import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Value sent as `accessibilityMode` when a screen reader is driving the flow.
 * `ChatAssistedRegistrationSchema` already accepts the field, so this needs no
 * backend change.
 */
export const SCREEN_READER_MODE = 'screen-reader';

/**
 * Tracks whether a screen reader is active, including changes made while the app
 * is open.
 *
 * @returns {boolean}
 */
export function useScreenReaderEnabled() {
    const [enabled, setEnabled] = useState(false);

    useEffect(() => {
        let cancelled = false;

        AccessibilityInfo.isScreenReaderEnabled?.().then((value) => {
            if (!cancelled) {
                setEnabled(Boolean(value));
            }
        });

        const subscription = AccessibilityInfo.addEventListener?.('screenReaderChanged', (value) => {
            setEnabled(Boolean(value));
        });

        return () => {
            cancelled = true;
            subscription?.remove?.();
        };
    }, []);

    return enabled;
}

/**
 * Speaks a message through the active screen reader.
 *
 * @param {string} message
 */
export function announce(message) {
    if (typeof message === 'string' && message.length > 0) {
        AccessibilityInfo.announceForAccessibility?.(message);
    }
}

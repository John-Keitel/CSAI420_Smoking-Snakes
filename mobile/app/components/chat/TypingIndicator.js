import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';

import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';

/**
 * Three pulsing dots shown while the assistant is "typing" (LOAD-01 → LOAD-03).
 *
 * Each dot fades in and out on a staggered delay so the eye reads them as
 * sequential activity rather than a single blink. The animation starts on
 * mount and stops on unmount — `Animated.loop` is cleaned up in the effect
 * return so no timer leaks across turns (LOAD-01).
 *
 * The container is announced as "STEDI is typing" to screen readers and
 * uses `accessibilityLiveRegion="polite"` so the announcement does not
 * interrupt the current speech (LOAD-02).
 *
 * @param {{visible: boolean}} props
 */
export default function TypingIndicator({ visible = true }) {
    const { styles } = useThemeStyles();
    const first = useRef(new Animated.Value(0.2)).current;
    const second = useRef(new Animated.Value(0.2)).current;
    const third = useRef(new Animated.Value(0.2)).current;

    useEffect(() => {
        if (!visible) {
            return undefined;
        }

        const pulse = (value, delay) =>
            Animated.loop(
                Animated.sequence([
                    Animated.delay(delay),
                    Animated.timing(value, {
                        toValue: 1,
                        duration: 400,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(value, {
                        toValue: 0.2,
                        duration: 400,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ])
            );

        const animations = [pulse(first, 0), pulse(second, 200), pulse(third, 400)];
        animations.forEach((anim) => anim.start());

        return () => {
            animations.forEach((anim) => anim.stop());
        };
    }, [first, second, third, visible]);

    if (!visible) {
        return null;
    }

    return (
        <View
            style={styles.typingIndicator}
            testID="typing-indicator"
            accessibilityLiveRegion="polite"
            accessibilityRole="text"
            accessibilityLabel="STEDI is typing"
            accessibilityHint="The assistant is preparing a reply"
        >
            <Animated.View style={[styles.typingDot, { opacity: first }]} />
            <Animated.View style={[styles.typingDot, { opacity: second }]} />
            <Animated.View style={[styles.typingDot, { opacity: third }]} />
            {/* Hidden label for screen readers that do not announce empty containers. */}
        </View>
    );
}
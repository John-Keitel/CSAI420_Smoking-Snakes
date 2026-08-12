import { useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';

/**
 * Post-chat feedback modal (FEEDBACK-01 → FEEDBACK-04).
 *
 * Shown after registration completes, asking "Was this onboarding helpful?"
 * with a thumbs up/down rating. The rating is recorded log-only via
 * `console.info` — no backend route is added (FEEDBACK-02), preserving the
 * v1 read-only backend constraint.
 *
 * @param {{visible: boolean, chatSessionId: string|null, onDismiss: Function}} props
 */
export default function FeedbackModal({ visible, chatSessionId, onDismiss }) {
    const { styles } = useThemeStyles();
    const [submitted, setSubmitted] = useState(false);

    const record = (rating) => {
        // Log-only: no backend route in V1. console.info avoids the
        // application logger's error-level noise; gated by the caller's
        // visibility so a dismissed sheet does not log.
        // eslint-disable-next-line no-console
        console.info('onboarding-feedback', { chatSessionId, rating });
        setSubmitted(true);
    };

    const dismiss = () => {
        setSubmitted(false);
        onDismiss();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={dismiss} testID="feedback-modal">
            <View style={styles.backdrop}>
                <View style={styles.feedbackSheet} accessibilityViewIsModal testID="feedback-sheet">
                    <Text style={styles.sheetTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        Was this onboarding helpful?
                    </Text>

                    {submitted ? (
                        <Text style={styles.successText} testID="feedback-thanks" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            Thanks for your feedback.
                        </Text>
                    ) : (
                        <View style={styles.feedbackActions} testID="feedback-actions">
                            <TouchableOpacity
                                style={styles.feedbackButton}
                                onPress={() => record('helpful')}
                                testID="feedback-helpful"
                                accessibilityRole="button"
                                accessibilityLabel="Yes, the onboarding was helpful"
                                accessibilityHint="Records a positive rating and closes the feedback"
                            >
                                <Text style={styles.buttonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                    Yes
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.feedbackButton}
                                onPress={() => record('not-helpful')}
                                testID="feedback-not-helpful"
                                accessibilityRole="button"
                                accessibilityLabel="No, the onboarding was not helpful"
                                accessibilityHint="Records a negative rating and closes the feedback"
                            >
                                <Text style={styles.buttonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                    No
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={dismiss}
                        testID="feedback-dismiss"
                        accessibilityRole="button"
                        accessibilityLabel="Close feedback and continue to sign in"
                        accessibilityHint="Closes the feedback modal"
                    >
                        <Text style={styles.closeButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            Continue to sign in
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

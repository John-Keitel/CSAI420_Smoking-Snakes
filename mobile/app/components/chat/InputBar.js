import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';

import { inputPropsForStep, validate } from '../../lib/stepRules';
import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';

// iOS insets the view above the keyboard; Android resizes it instead.
// Exported because KeyboardAvoidingView consumes the prop rather than forwarding
// it to a host node, so this is the only way to assert it.
export const KEYBOARD_BEHAVIOR = Platform.OS === 'ios' ? 'padding' : 'height';

/**
 * One conversational turn: type, validate, submit.
 *
 * Validation happens here rather than server-side because the API validates
 * nothing - advanceChat() accepts any string at every step - so an invalid answer
 * would otherwise surface only as a bulk 400 after all six questions.
 *
 * @param {{currentStep: string, pending: boolean, onSubmit: Function}} props
 */
export default function InputBar({ currentStep, pending, onSubmit }) {
    const { styles } = useThemeStyles();
    const [draft, setDraft] = useState('');
    const [error, setError] = useState(null);
    const [focused, setFocused] = useState(false);
    const [sendFocused, setSendFocused] = useState(false);

    const inputProps = inputPropsForStep(currentStep);
    const isSecure = inputProps.secureTextEntry === true;

    const handleChange = useCallback((next) => {
        setDraft(next);
        setError(null);
    }, []);

    const handleSubmit = useCallback(() => {
        if (pending) {
            return;
        }

        // A password may legitimately begin or end with a space; nothing else may.
        const value = isSecure ? draft : draft.trim();

        if (value.trim().length === 0) {
            return;
        }

        const result = validate(currentStep, value);

        if (!result.valid) {
            setError(result.error);
            return;
        }

        setError(null);
        setDraft('');
        onSubmit(value);
    }, [currentStep, draft, isSecure, onSubmit, pending]);

    return (
        <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.inputBar} testID="chat-input-bar">
            <View style={styles.inputRow}>
                <TextInput
                    {...inputProps}
                    style={[styles.chatInput, focused && styles.chatInputFocused]}
                    value={draft}
                    onChangeText={handleChange}
                    onSubmitEditing={handleSubmit}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                    editable={!pending}
                    multiline={!isSecure}
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    testID="chat-input"
                    accessibilityLabel="Your reply"
                    accessibilityHint="Enter your answer to the current question"
                />
                <Pressable
                    style={[styles.sendButton, sendFocused && styles.sendButtonFocused, pending ? styles.sendButtonDisabled : null]}
                    onPress={handleSubmit}
                    onFocus={() => setSendFocused(true)}
                    onBlur={() => setSendFocused(false)}
                    disabled={pending}
                    testID="chat-send-button"
                    accessibilityRole="button"
                    accessibilityLabel={pending ? 'Sending your reply' : 'Send reply'}
                    accessibilityHint="Submits your reply"
                >
                    <Text style={styles.sendButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {pending ? '...' : 'Send'}
                    </Text>
                </Pressable>
            </View>

            {error === null ? null : (
                <Text style={styles.errorText} testID="chat-input-error" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    {error}
                </Text>
            )}
        </KeyboardAvoidingView>
    );
}

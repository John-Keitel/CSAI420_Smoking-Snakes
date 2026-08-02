import { useCallback, useEffect, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { continueSession } from '../../api/chatClient';
import { fieldForStep, INITIAL_CHAT_STEP } from '../../lib/stepRules';
import { useThemeStyles } from '../Styles';

/**
 * `message` is required (min 1), so the first prompt cannot be obtained without
 * sending something. This opener fills no field.
 */
export const OPENER_MESSAGE = 'I need help signing up';

const GENERIC_FAILURE = 'Something went wrong. Please check your connection and try again.';

const initialState = {
    currentStep: INITIAL_CHAT_STEP,
    transcript: [],
    collected: {},
    credentialTurnIndex: null,
    error: null,
    lastActivity: null,
};

/**
 * The conversational registration surface.
 *
 * Owns every piece of session state and is the only component that talks to the
 * transport. Children are presentational.
 *
 * @param {{visible: boolean, chatSessionId: string|null, onDismiss: Function}} props
 */
export default function ChatSheet({ visible, chatSessionId, onDismiss }) {
    const { styles } = useThemeStyles();
    const [session, setSession] = useState(initialState);
    const [pending, setPending] = useState(false);
    const [draft, setDraft] = useState('');

    const applyFailure = useCallback((result) => {
        const message = result.kind === 'invalid' && result.errors?.length > 0 ? result.errors.join('\n') : GENERIC_FAILURE;

        setSession((previous) => ({ ...previous, error: message }));
    }, []);

    // A new chatSessionId means a new conversation: reset, then fetch the first
    // prompt. Reopening a dismissed sheet mints a new id, so this also satisfies
    // "reopening starts an empty transcript".
    useEffect(() => {
        if (!visible || !chatSessionId) {
            return undefined;
        }

        let cancelled = false;

        setSession(initialState);
        setDraft('');
        setPending(true);

        continueSession({
            chatSessionId,
            message: OPENER_MESSAGE,
            context: INITIAL_CHAT_STEP,
        }).then((result) => {
            if (cancelled) {
                return;
            }

            if (result.ok) {
                setSession((previous) => ({
                    ...previous,
                    transcript: result.conversationContext,
                    currentStep: result.nextStep,
                    lastActivity: new Date().toISOString(),
                }));
            } else {
                applyFailure(result);
            }

            // Reset unconditionally: a stuck spinner is the failure mode SHEET-05
            // exists to prevent.
            setPending(false);
        });

        return () => {
            cancelled = true;
        };
    }, [visible, chatSessionId, applyFailure]);

    const sendTurn = useCallback(
        async (message) => {
            if (pending || !chatSessionId) {
                return;
            }

            // Captured before the request: the field a message fills is decided by
            // the step the session is in when it is SENT, not by the step the
            // response returns.
            const answeredStep = session.currentStep;

            setPending(true);
            setSession((previous) => ({ ...previous, error: null }));

            const result = await continueSession({ chatSessionId, message, context: answeredStep });

            if (!result.ok) {
                applyFailure(result);
                setPending(false);
                return;
            }

            const field = fieldForStep(answeredStep);

            setSession((previous) => ({
                ...previous,
                transcript: result.conversationContext,
                currentStep: result.nextStep,
                collected: field ? { ...previous.collected, [field]: message } : previous.collected,
                // The server appends [user, assistant], so the turn just sent sits
                // second from the end. Tracked by index rather than by value so an
                // unrelated turn equal to the password is not masked too.
                credentialTurnIndex:
                    answeredStep === 'password_collection' ? result.conversationContext.length - 2 : previous.credentialTurnIndex,
                lastActivity: new Date().toISOString(),
            }));

            setPending(false);
        },
        [applyFailure, chatSessionId, pending, session.currentStep]
    );

    const handleSend = useCallback(() => {
        const trimmed = draft.trim();

        if (trimmed.length === 0) {
            return;
        }

        setDraft('');
        sendTurn(trimmed);
    }, [draft, sendTurn]);

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss} testID="chat-sheet">
            <View style={styles.backdrop}>
                <TouchableOpacity
                    style={styles.backdropDismissArea}
                    onPress={onDismiss}
                    testID="chat-backdrop"
                    accessibilityRole="button"
                    accessibilityLabel="Close the sign up assistant"
                />

                <View style={styles.sheet}>
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle}>Sign up assistant</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onDismiss}
                            testID="chat-close-button"
                            accessibilityRole="button"
                            accessibilityLabel="Close the sign up assistant"
                        >
                            <Text style={styles.closeButtonText}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.messageList} testID="chat-transcript">
                        {session.transcript.map((entry, index) => (
                            <Text
                                key={`${entry.role}-${index}`}
                                testID={`chat-message-${index}`}
                                style={[styles.bubbleBase, entry.role === 'user' ? styles.userBubble : styles.assistantBubble]}
                            >
                                {index === session.credentialTurnIndex ? '••••••••' : entry.message}
                            </Text>
                        ))}
                    </ScrollView>

                    {session.error === null ? null : (
                        <Text style={styles.errorText} testID="chat-error">
                            {session.error}
                        </Text>
                    )}

                    <View style={styles.inputBar}>
                        <View style={styles.inputRow}>
                            <TextInput
                                style={styles.chatInput}
                                value={draft}
                                onChangeText={setDraft}
                                editable={!pending}
                                testID="chat-input"
                                accessibilityLabel="Your reply"
                            />
                            <TouchableOpacity
                                style={[styles.sendButton, pending ? styles.sendButtonDisabled : null]}
                                onPress={handleSend}
                                disabled={pending}
                                testID="chat-send-button"
                                accessibilityRole="button"
                                accessibilityLabel="Send reply"
                            >
                                <Text style={styles.sendButtonText}>{pending ? '...' : 'Send'}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

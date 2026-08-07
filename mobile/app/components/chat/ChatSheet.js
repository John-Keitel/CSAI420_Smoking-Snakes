import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { continueSession, registerChatAssisted } from '../../api/chatClient';
import { fieldForStep, FINAL_CHAT_STEP, INITIAL_CHAT_STEP, toUserData } from '../../lib/stepRules';
import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';
import InputBar from './InputBar';
import MessageList from './MessageList';

/**
 * `message` is required (min 1), so the first prompt cannot be obtained without
 * sending something. This opener fills no field.
 */
export const OPENER_MESSAGE = 'I need help signing up';

const GENERIC_FAILURE = 'Something went wrong. Please check your connection and try again.';

const NO_MASKED_INDEXES = [];

const initialState = {
    currentStep: INITIAL_CHAT_STEP,
    transcript: [],
    collected: {},
    credentialTurnIndex: null,
    error: null,
    lastActivity: null,
    retryField: null,
    expired: false,
};

/**
 * The conversational registration surface.
 *
 * Owns every piece of session state and is the only component that talks to the
 * transport. Children are presentational.
 *
 * @param {{visible: boolean, chatSessionId: string|null, onDismiss: Function,
 *   onRegistered?: Function, onRestart?: Function, accessibilityMode?: string|null}} props
 */
export default function ChatSheet({ visible, chatSessionId, onDismiss, onRegistered, onRestart, accessibilityMode = null }) {
    const { styles } = useThemeStyles();
    const [session, setSession] = useState(initialState);
    const [pending, setPending] = useState(false);

    const applyFailure = useCallback((result) => {
        const message = result.kind === 'invalid' && result.errors?.length > 0 ? result.errors.join('\n') : GENERIC_FAILURE;

        setSession((previous) => ({ ...previous, error: message }));
    }, []);

    // A new chatSessionId means a new conversation: reset, then fetch the first
    // prompt. Reopening a dismissed sheet mints a new id, so this also gives
    // SHEET-07 its empty transcript.
    useEffect(() => {
        if (!visible || !chatSessionId) {
            return undefined;
        }

        let cancelled = false;

        setSession(initialState);
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

            setPending(false);
        });

        return () => {
            cancelled = true;
        };
    }, [visible, chatSessionId, applyFailure]);

    const submitRegistration = useCallback(
        async (collected, transcript, credentialTurnIndex, lastActivity) => {
            // The credential turn is withheld from the log we re-transmit. It still
            // reached /chat/continue-session and is stored there - a backend defect
            // this client cannot fix - but it is not sent a second time.
            const conversationLog = transcript.filter((_entry, index) => index !== credentialTurnIndex);

            const payload = {
                userData: toUserData(collected),
                chatSessionId,
                conversationLog,
            };

            if (lastActivity) {
                // The real timestamp, not "now": sending "now" would make the
                // 30-minute inactivity window unreachable.
                payload.lastActivity = lastActivity;
            }

            if (accessibilityMode) {
                payload.accessibilityMode = accessibilityMode;
            }

            const result = await registerChatAssisted(payload);

            if (result.ok) {
                onRegistered?.(result.user);
                return;
            }

            if (result.kind === 'duplicate') {
                setSession((previous) => ({
                    ...previous,
                    // Keep the conversation; only the email needs replacing.
                    retryField: 'email',
                    error: `${result.message}. Enter a different email address to finish.`,
                }));
                return;
            }

            if (result.kind === 'expired') {
                setSession((previous) => ({ ...previous, expired: true, error: result.message }));
                return;
            }

            applyFailure(result);
        },
        [accessibilityMode, applyFailure, chatSessionId, onRegistered]
    );

    const sendTurn = useCallback(
        async (message) => {
            if (pending || !chatSessionId) {
                return;
            }

            setPending(true);
            setSession((previous) => ({ ...previous, error: null }));

            // Replacing a rejected email does not advance the conversation - it
            // just corrects one field and retries the account creation.
            if (session.retryField === 'email') {
                const collected = { ...session.collected, email: message };

                setSession((previous) => ({ ...previous, collected, retryField: null }));
                await submitRegistration(collected, session.transcript, session.credentialTurnIndex, session.lastActivity);
                setPending(false);
                return;
            }

            // Captured before the request: the field a message fills is decided by
            // the step the session is in when it is SENT, not by the step the
            // response returns.
            const answeredStep = session.currentStep;
            const result = await continueSession({ chatSessionId, message, context: answeredStep });

            if (!result.ok) {
                applyFailure(result);
                setPending(false);
                return;
            }

            const field = fieldForStep(answeredStep);
            const collected = field ? { ...session.collected, [field]: message } : session.collected;
            // The server appends [user, assistant], so the turn just sent sits
            // second from the end. Tracked by index rather than by value so an
            // unrelated turn equal to the password is not masked too.
            const credentialTurnIndex =
                answeredStep === 'password_collection' ? result.conversationContext.length - 2 : session.credentialTurnIndex;
            const lastActivity = new Date().toISOString();

            setSession((previous) => ({
                ...previous,
                transcript: result.conversationContext,
                currentStep: result.nextStep,
                collected,
                credentialTurnIndex,
                lastActivity,
            }));

            if (result.nextStep === FINAL_CHAT_STEP) {
                await submitRegistration(collected, result.conversationContext, credentialTurnIndex, lastActivity);
            }

            setPending(false);
        },
        [applyFailure, chatSessionId, pending, session, submitRegistration]
    );

    const maskedIndexes = useMemo(
        () => (session.credentialTurnIndex === null ? NO_MASKED_INDEXES : [session.credentialTurnIndex]),
        [session.credentialTurnIndex]
    );

    const effectiveStep = session.retryField === 'email' ? 'email_collection' : session.currentStep;

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss} testID="chat-sheet">
            <View style={styles.backdrop}>
                <TouchableOpacity
                    style={styles.backdropDismissArea}
                    onPress={onDismiss}
                    testID="chat-backdrop"
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss the sign up assistant"
                    accessibilityHint="Closes the sign up assistant without submitting"
                />

                <View style={styles.sheet} accessibilityViewIsModal testID="chat-sheet-surface">
                    <View style={styles.sheetHeader}>
                        <Text style={styles.sheetTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            Sign up assistant
                        </Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={onDismiss}
                            testID="chat-close-button"
                            accessibilityRole="button"
                            accessibilityLabel="Close the sign up assistant"
                            accessibilityHint="Closes the sign up assistant"
                        >
                            <Text style={styles.closeButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                Done
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <MessageList entries={session.transcript} maskedIndexes={maskedIndexes} />

                    {session.error === null ? null : (
                        <Text style={styles.errorText} testID="chat-error" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {session.error}
                        </Text>
                    )}

                    {session.expired ? (
                        <View style={styles.inputBar}>
                            <TouchableOpacity
                                style={styles.button}
                                onPress={onRestart ?? onDismiss}
                                testID="chat-restart-button"
                                accessibilityRole="button"
                                accessibilityLabel="Start a new sign up chat"
                                accessibilityHint="Starts a new sign-up conversation"
                            >
                                <Text style={styles.buttonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                    Start over
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <InputBar currentStep={effectiveStep} pending={pending} onSubmit={sendTurn} />
                    )}
                </View>
            </View>
        </Modal>
    );
}

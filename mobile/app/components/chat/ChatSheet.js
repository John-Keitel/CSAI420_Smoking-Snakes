import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, AppState, findNodeHandle, Modal, Pressable, Text, TouchableOpacity, View } from 'react-native';

import { continueSession, registerChatAssisted } from '../../api/chatClient';
import { announce } from '../../lib/accessibility';
import { errorOccurred } from '../../lib/hapticController';
import { fieldForStep, FINAL_CHAT_STEP, INITIAL_CHAT_STEP, toUserData } from '../../lib/stepRules';
import * as sessionStore from '../../lib/sessionStore';
import * as voiceController from '../../lib/voiceController';
import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';
import FeedbackModal from './FeedbackModal';
import InputBar from './InputBar';
import MessageList from './MessageList';
import TypingIndicator from './TypingIndicator';

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
    const [closeFocused, setCloseFocused] = useState(false);
    const [restartFocused, setRestartFocused] = useState(false);
    const titleRef = useRef(null);

    // Moves screen reader focus onto the sheet title as soon as it opens
    // (A11Y-08), so VoiceOver/TalkBack users land somewhere meaningful instead
    // of having to explore the whole screen to discover the modal appeared.
    useEffect(() => {
        if (!visible) {
            return;
        }

        const tag = findNodeHandle(titleRef.current);

        if (tag) {
            AccessibilityInfo.setAccessibilityFocus(tag);
        }
    }, [visible]);

    // Speaks a failure the moment it appears (A11Y-11). MessageList already
    // announces assistant replies, but errors are rendered directly by this
    // component, so without this a screen reader user who submits a bad
    // answer hears nothing until they go looking for the error text.
    useEffect(() => {
        if (session.error) {
            announce(session.error);
        }
    }, [session.error]);

    const [ttsSupported, setTtsSupported] = useState(false);
    // RESTORE-04: when a restored session was at the password step, the password
    // was stripped and the user must re-enter it.
    const [passwordRePrompt, setPasswordRePrompt] = useState(false);
    // FEEDBACK-01: show the feedback modal after registration completes, before
    // the sheet closes. The registered user is held so the parent's onRegistered
    // fires only when the user dismisses the feedback.
    const [registeredUser, setRegisteredUser] = useState(null);

    // Check TTS support once when the sheet first becomes visible (VOICE-03).
    // The affordance is hidden entirely on unsupported devices rather than
    // failing at runtime.
    useEffect(() => {
        if (!visible) {
            return undefined;
        }

        let cancelled = false;
        voiceController.isSupported().then((supported) => {
            if (!cancelled) {
                setTtsSupported(supported);
            }
        });

        return () => {
            cancelled = true;
        };
    }, [visible]);

    // Stop any in-flight speech when the sheet dismisses or unmounts, so a
    // reply started in a dismissed sheet does not keep talking into the next.
    useEffect(() => {
        if (visible) {
            return undefined;
        }
        voiceController.stop();
        return () => voiceController.stop();
    }, [visible]);

    // RESTORE-01: persist the session on app background so a minimized
    // conversation survives. Debounced via AppState — only 'background'/
    // 'inactive' trigger a save; 'active' does not (the user is still here).
    useEffect(() => {
        if (!visible) {
            return undefined;
        }

        const subscription = AppState.addEventListener('change', (nextState) => {
            if (nextState === 'background' || nextState === 'inactive') {
                const { password, ...collectedWithoutPassword } = session.collected;
                void password;
                sessionStore.save({ ...session, collected: collectedWithoutPassword, chatSessionId });
            }
        });

        return () => {
            subscription?.remove?.();
        };
    }, [visible, session, chatSessionId]);

    // Fires on every path that sets session.error - applyFailure below, plus
    // the duplicate-email and expired-session branches in submitRegistration -
    // rather than duplicating a haptic call at each of those sites.
    useEffect(() => {
        if (session.error) {
            errorOccurred();
        }
    }, [session.error]);

    const applyFailure = useCallback((result) => {
        const message = result.kind === 'invalid' && result.errors?.length > 0 ? result.errors.join('\n') : GENERIC_FAILURE;

        setSession((previous) => ({ ...previous, error: message }));
    }, []);

    // A new chatSessionId means a new conversation: reset, then fetch the first
    // prompt. Reopening a dismissed sheet mints a new id, so this also gives
    // SHEET-07 its empty transcript. RESTORE-02: if a persisted session exists
    // for this id and has not expired, resume it instead of re-opening.
    useEffect(() => {
        if (!visible || !chatSessionId) {
            return undefined;
        }

        let cancelled = false;

        setPending(true);

        (async () => {
            const restored = await sessionStore.load();

            if (cancelled) {
                return;
            }

            // Only resume if the persisted session belongs to this conversation.
            if (restored && restored.chatSessionId === chatSessionId) {
                const wasAtPassword = restored.currentStep === 'password_collection';
                setPasswordRePrompt(wasAtPassword);

                setSession({
                    currentStep: restored.currentStep,
                    transcript: restored.transcript ?? [],
                    collected: restored.collected ?? {},
                    credentialTurnIndex: restored.credentialTurnIndex ?? null,
                    error: null,
                    lastActivity: restored.lastActivity ?? null,
                    retryField: null,
                    expired: false,
                });
                setPending(false);
                return;
            }

            // No matching persisted session: open fresh.
            setPasswordRePrompt(false);
            setSession(initialState);

            const result = await continueSession({
                chatSessionId,
                message: OPENER_MESSAGE,
                context: INITIAL_CHAT_STEP,
            });

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
        })();

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
                // RESTORE-05: the conversation is done; clear the persisted
                // session so it does not resurrect on the next open.
                sessionStore.clear();
                // FEEDBACK-01: hold the user and show the feedback modal; the
                // parent's onRegistered fires when the user dismisses it.
                setRegisteredUser(result.user);
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
                        <Text ref={titleRef} accessible style={styles.sheetTitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            Sign up assistant
                        </Text>
                        <Pressable
                            style={[styles.closeButton, closeFocused && styles.closeButtonFocused]}
                            onPress={onDismiss}
                            onFocus={() => setCloseFocused(true)}
                            onBlur={() => setCloseFocused(false)}
                            testID="chat-close-button"
                            accessibilityRole="button"
                            accessibilityLabel="Close the sign up assistant"
                            accessibilityHint="Closes the sign up assistant"
                        >
                            <Text style={styles.closeButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                Done
                            </Text>
                        </Pressable>
                    </View>

                    <MessageList entries={session.transcript} maskedIndexes={maskedIndexes} ttsSupported={ttsSupported} />

                    {session.error === null ? null : (
                        <Text style={styles.errorText} testID="chat-error" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            {session.error}
                        </Text>
                    )}

                    {passwordRePrompt ? (
                        <Text style={styles.noticeText} testID="password-reprompt" maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            Your session was restored. Please re-enter your password to continue.
                        </Text>
                    ) : null}

                    {session.expired ? (
                        <View style={styles.inputBar}>
                            <Pressable
                                style={[styles.button, restartFocused && styles.buttonFocused]}
                                onPress={onRestart ?? onDismiss}
                                onFocus={() => setRestartFocused(true)}
                                onBlur={() => setRestartFocused(false)}
                                testID="chat-restart-button"
                                accessibilityRole="button"
                                accessibilityLabel="Start a new sign up chat"
                                accessibilityHint="Starts a new sign-up conversation"
                            >
                                <Text style={styles.buttonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                                    Start over
                                </Text>
                            </Pressable>
                        </View>
                    ) : (
                        <>
                            <TypingIndicator visible={pending} />
                            <InputBar currentStep={effectiveStep} pending={pending} onSubmit={sendTurn} />
                        </>
                    )}
                </View>
            </View>
            <FeedbackModal
                visible={registeredUser !== null}
                chatSessionId={chatSessionId}
                onDismiss={() => {
                    const user = registeredUser;
                    setRegisteredUser(null);
                    onRegistered?.(user);
                }}
            />
        </Modal>
    );
}

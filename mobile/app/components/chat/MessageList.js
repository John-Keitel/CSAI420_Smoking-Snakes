import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Text, TouchableOpacity, View } from 'react-native';

import { announce } from '../../lib/accessibility';
import * as voiceController from '../../lib/voiceController';
import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';

/** Stand-in for a credential turn. The typed characters never reach a Text node. */
export const MASKED_MESSAGE = '••••••••';

const NO_MASKED_INDEXES = [];

const keyExtractor = (item, index) => `${item.role}-${index}`;

/**
 * The per-bubble "Read aloud" control (VOICE-01 → VOICE-04).
 *
 * Hidden on credential turns (the password is never spoken) and on devices
 * where TTS is unsupported. While speaking, swaps to "Stop".
 */
function ReadAloudAffordance({ text, speaking, onSpeak, onStop, styles }) {
    const label = speaking ? 'Stop reading aloud' : 'Read this message aloud';
    const testID = speaking ? `read-aloud-stop` : `read-aloud`;

    return (
        <TouchableOpacity
            style={styles.readAloudButton}
            onPress={speaking ? onStop : onSpeak}
            testID={testID}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityHint={speaking ? 'Stops the spoken playback of this message' : 'Reads this assistant reply aloud'}
        >
            <Text style={styles.readAloudButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {speaking ? 'Stop' : 'Read aloud'}
            </Text>
        </TouchableOpacity>
    );
}

/**
 * The conversation transcript.
 *
 * Entries are `{role, message}` - note `message`, not `content`, which is the
 * shape used by the unrelated mock LangGraph endpoints.
 *
 * @param {{entries: Array<{role: string, message: string}>, maskedIndexes?: number[], ttsSupported?: boolean}} props
 */
export default function MessageList({ entries, maskedIndexes = NO_MASKED_INDEXES, ttsSupported = false }) {
    const { styles } = useThemeStyles();
    const listRef = useRef(null);

    const masked = useMemo(() => new Set(maskedIndexes), [maskedIndexes]);
    const announcedRef = useRef(null);
    const [speakingIndex, setSpeakingIndex] = useState(null);

    // A new reply arrives below the fold, so a screen reader user would otherwise
    // have to go looking for it.
    useEffect(() => {
        const latest = entries[entries.length - 1];

        if (!latest || latest.role !== 'assistant' || announcedRef.current === latest.message) {
            return;
        }

        announcedRef.current = latest.message;
        announce(latest.message);
    }, [entries]);

    // Stop any in-flight speech when the transcript unmounts or the surface
    // dismisses, so a reply started in a dismissed sheet does not keep talking
    // into the next session.
    useEffect(() => {
        return () => {
            voiceController.stop();
        };
    }, []);

    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: true });
    }, []);

    const speak = useCallback((index, text) => {
        setSpeakingIndex(index);
        voiceController.speak(text, {
            onDone: () => setSpeakingIndex((current) => (current === index ? null : current)),
            onStopped: () => setSpeakingIndex((current) => (current === index ? null : current)),
            onError: () => setSpeakingIndex((current) => (current === index ? null : current)),
        });
    }, []);

    const stop = useCallback(() => {
        voiceController.stop();
        setSpeakingIndex(null);
    }, []);

    const renderItem = useCallback(
        ({ item, index }) => {
            const isUser = item.role === 'user';
            const text = masked.has(index) ? MASKED_MESSAGE : item.message;
            const canReadAloud = ttsSupported && !isUser && !masked.has(index);
            const isSpeakingThis = speakingIndex === index;

            return (
                <View
                    style={[styles.bubbleBase, isUser ? styles.userBubble : styles.assistantBubble]}
                    testID={`chat-message-${index}`}
                    accessible
                    accessibilityRole="text"
                    accessibilityLabel={`${isUser ? 'You said' : 'Assistant said'}: ${text}`}
                    accessibilityHint="Read this conversation message"
                >
                    <Text style={isUser ? styles.userBubbleText : styles.assistantBubbleText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        {text}
                    </Text>
                    {canReadAloud ? (
                        <ReadAloudAffordance
                            text={item.message}
                            speaking={isSpeakingThis}
                            onSpeak={() => speak(index, item.message)}
                            onStop={stop}
                            styles={styles}
                        />
                    ) : null}
                </View>
            );
        },
        [masked, speakingIndex, speak, stop, styles, ttsSupported]
    );

    return (
        <FlatList
            ref={listRef}
            data={entries}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            onContentSizeChange={scrollToEnd}
            contentContainerStyle={styles.messageList}
            // An onboarding conversation is bounded at roughly fourteen turns, so
            // windowing buys nothing and the default batch of ten silently drops
            // the newest messages - the exact opposite of what a chat needs.
            initialNumToRender={entries.length || 1}
            accessibilityLiveRegion="polite"
            testID="chat-transcript"
        />
    );
}

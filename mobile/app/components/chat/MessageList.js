import { useCallback, useEffect, useMemo, useRef } from 'react';
import { FlatList, Text, View } from 'react-native';

import { announce } from '../../lib/accessibility';
import { speak } from '../../lib/voiceController';
import { MAX_FONT_SCALE, useThemeStyles } from '../Styles';

/** Stand-in for a credential turn. The typed characters never reach a Text node. */
export const MASKED_MESSAGE = '••••••••';

const NO_MASKED_INDEXES = [];

const keyExtractor = (item, index) => `${item.role}-${index}`;

/**
 * The conversation transcript.
 *
 * Entries are `{role, message}` - note `message`, not `content`, which is the
 * shape used by the unrelated mock LangGraph endpoints.
 *
 * @param {{entries: Array<{role: string, message: string}>, maskedIndexes?: number[]}} props
 */
export default function MessageList({ entries, maskedIndexes = NO_MASKED_INDEXES }) {
    const { styles } = useThemeStyles();
    const listRef = useRef(null);

    const masked = useMemo(() => new Set(maskedIndexes), [maskedIndexes]);
    const announcedRef = useRef(null);

    // A new reply arrives below the fold, so a screen reader user would otherwise
    // have to go looking for it. The same guard also gates the audio cue
    // (HAPTIC/VOICE wiring) below, so a re-render never re-speaks or re-announces
    // a message this effect already handled.
    useEffect(() => {
        const latest = entries[entries.length - 1];

        if (!latest || latest.role !== 'assistant' || announcedRef.current === latest.message) {
            return;
        }

        announcedRef.current = latest.message;
        announce(latest.message);
        // speak() stops any in-flight utterance itself before starting the next
        // one, so turns never overlap even if replies arrive close together.
        speak(latest.message);
    }, [entries]);

    const scrollToEnd = useCallback(() => {
        listRef.current?.scrollToEnd({ animated: true });
    }, []);

    const renderItem = useCallback(
        ({ item, index }) => {
            const isUser = item.role === 'user';
            const text = masked.has(index) ? MASKED_MESSAGE : item.message;

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
                </View>
            );
        },
        [masked, styles]
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

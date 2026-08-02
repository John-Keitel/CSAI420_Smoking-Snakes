import { StyleSheet, useColorScheme } from 'react-native';

const palette = {
    light: {
        background: '#ffffff',
        surface: '#f4f5f7',
        text: '#11181c',
        mutedText: '#5c6b73',
        primary: '#2141b1',
        onPrimary: '#ffffff',
        border: '#d9dde2',
        danger: '#b3261e',
        assistantBubble: '#e8ebf3',
        userBubble: '#2141b1',
        onUserBubble: '#ffffff',
        backdrop: 'rgba(0, 0, 0, 0.45)',
    },
    dark: {
        background: '#11181c',
        surface: '#1c2529',
        text: '#f2f5f7',
        mutedText: '#a3b1b8',
        primary: '#7d97ea',
        onPrimary: '#0b1020',
        border: '#2f3a40',
        danger: '#f2b8b5',
        assistantBubble: '#26313a',
        userBubble: '#3a5bd9',
        onUserBubble: '#ffffff',
        backdrop: 'rgba(0, 0, 0, 0.65)',
    },
};

/** Minimum touch target required by HELP-05 and the platform guidelines. */
export const MIN_TOUCH_TARGET = 44;

/**
 * Caps how far OS text scaling may grow chat text (A11Y-05). Text still scales -
 * it is never disabled - but beyond roughly double the layout stops being usable.
 */
export const MAX_FONT_SCALE = 2;

/**
 * Theme-aware styles, following the rn1 `useThemeStyles()` idiom.
 *
 * @returns {{styles: object, colors: object}}
 */
export function useThemeStyles() {
    const scheme = useColorScheme();
    const colors = palette[scheme === 'dark' ? 'dark' : 'light'];

    const styles = StyleSheet.create({
        screen: {
            flex: 1,
            backgroundColor: colors.background,
            padding: 24,
        },
        title: {
            fontSize: 24,
            fontWeight: '700',
            color: colors.text,
            marginBottom: 8,
        },
        subtitle: {
            fontSize: 15,
            color: colors.mutedText,
            marginBottom: 24,
        },
        label: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.text,
            marginBottom: 6,
        },
        textInput: {
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 16,
            color: colors.text,
            backgroundColor: colors.surface,
            marginBottom: 16,
        },
        button: {
            backgroundColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: MIN_TOUCH_TARGET,
        },
        buttonText: {
            color: colors.onPrimary,
            fontSize: 16,
            fontWeight: '600',
        },
        secondaryButton: {
            borderWidth: 1,
            borderColor: colors.primary,
            borderRadius: 8,
            paddingVertical: 12,
            paddingHorizontal: 20,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: MIN_TOUCH_TARGET,
            minWidth: MIN_TOUCH_TARGET,
        },
        secondaryButtonText: {
            color: colors.primary,
            fontSize: 16,
            fontWeight: '600',
        },
        backdrop: {
            flex: 1,
            backgroundColor: colors.backdrop,
            justifyContent: 'flex-end',
        },
        sheet: {
            backgroundColor: colors.background,
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            maxHeight: '90%',
            minHeight: '60%',
            paddingBottom: 12,
        },
        sheetHeader: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 12,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
        },
        sheetTitle: {
            fontSize: 17,
            fontWeight: '700',
            color: colors.text,
            flexShrink: 1,
        },
        closeButton: {
            minWidth: MIN_TOUCH_TARGET,
            minHeight: MIN_TOUCH_TARGET,
            alignItems: 'center',
            justifyContent: 'center',
        },
        closeButtonText: {
            fontSize: 17,
            fontWeight: '600',
            color: colors.primary,
        },
        messageList: {
            flexGrow: 1,
            paddingHorizontal: 16,
            paddingVertical: 12,
        },
        bubbleBase: {
            maxWidth: '85%',
            borderRadius: 14,
            paddingHorizontal: 14,
            paddingVertical: 10,
            marginBottom: 10,
        },
        assistantBubble: {
            alignSelf: 'flex-start',
            backgroundColor: colors.assistantBubble,
            borderBottomLeftRadius: 4,
        },
        userBubble: {
            alignSelf: 'flex-end',
            backgroundColor: colors.userBubble,
            borderBottomRightRadius: 4,
        },
        assistantBubbleText: {
            fontSize: 16,
            color: colors.text,
            flexShrink: 1,
        },
        userBubbleText: {
            fontSize: 16,
            color: colors.onUserBubble,
            flexShrink: 1,
        },
        inputBar: {
            borderTopWidth: 1,
            borderTopColor: colors.border,
            paddingHorizontal: 16,
            paddingTop: 12,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
        },
        chatInput: {
            flex: 1,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingVertical: 10,
            fontSize: 16,
            color: colors.text,
            backgroundColor: colors.surface,
            marginRight: 8,
            maxHeight: 120,
            minHeight: MIN_TOUCH_TARGET,
        },
        sendButton: {
            backgroundColor: colors.primary,
            borderRadius: 20,
            paddingHorizontal: 18,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: MIN_TOUCH_TARGET,
            minWidth: MIN_TOUCH_TARGET,
        },
        sendButtonDisabled: {
            opacity: 0.5,
        },
        sendButtonText: {
            color: colors.onPrimary,
            fontSize: 16,
            fontWeight: '600',
        },
        errorText: {
            color: colors.danger,
            fontSize: 14,
            marginTop: 8,
            flexShrink: 1,
        },
        noticeText: {
            color: colors.mutedText,
            fontSize: 14,
            marginTop: 8,
            flexShrink: 1,
        },
    });

    return { styles, colors };
}

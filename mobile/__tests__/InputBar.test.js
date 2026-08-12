import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform, StyleSheet, Text, TextInput } from 'react-native';

import InputBar, { KEYBOARD_BEHAVIOR } from '../app/components/chat/InputBar';
import { MAX_FONT_SCALE } from '../app/components/Styles';

/** The error Text holds a single string child. */
const errorText = () => screen.getByTestId('chat-input-error').props.children;

const renderBar = (props = {}) => {
    const onSubmit = jest.fn();
    const utils = render(<InputBar currentStep="name_provided" pending={false} onSubmit={onSubmit} {...props} />);

    return { ...utils, onSubmit };
};

const type = (value) => fireEvent.changeText(screen.getByTestId('chat-input'), value);
const send = () => fireEvent.press(screen.getByTestId('chat-send-button'));

describe('submitting a turn (INPUT-01, INPUT-02)', () => {
    it('sends the typed text and clears the field', () => {
        const { onSubmit } = renderBar();

        type('Alex Johnson');
        send();

        expect(onSubmit).toHaveBeenCalledWith('Alex Johnson');
        expect(screen.getByTestId('chat-input').props.value).toBe('');
    });

    it('trims surrounding whitespace on ordinary answers', () => {
        const { onSubmit } = renderBar();

        type('  Alex Johnson  ');
        send();

        expect(onSubmit).toHaveBeenCalledWith('Alex Johnson');
    });

    it('preserves whitespace inside a password, which may legitimately contain it', () => {
        const { onSubmit } = renderBar({ currentStep: 'password_collection' });

        type(' Str0ngP@ss ');
        send();

        expect(onSubmit).toHaveBeenCalledWith(' Str0ngP@ss ');
    });

    it.each([
        ['empty', ''],
        ['whitespace only', '    '],
    ])('issues no request for %s input', (_label, value) => {
        const { onSubmit } = renderBar();

        type(value);
        send();

        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('submits from the keyboard return key', () => {
        const { onSubmit } = renderBar();

        type('Alex Johnson');
        fireEvent(screen.getByTestId('chat-input'), 'submitEditing');

        expect(onSubmit).toHaveBeenCalledWith('Alex Johnson');
    });
});

describe('keyboard handling (INPUT-03, INPUT-04)', () => {
    it('avoids the keyboard with the behaviour appropriate to the platform', () => {
        renderBar();

        expect(screen.getByTestId('chat-input-bar')).toBeTruthy();
        expect(KEYBOARD_BEHAVIOR).toBe(Platform.OS === 'ios' ? 'padding' : 'height');
    });

    it('uses an email keyboard with autocapitalisation off at the email step', () => {
        renderBar({ currentStep: 'email_collection' });

        const input = screen.getByTestId('chat-input');
        expect(input.props.keyboardType).toBe('email-address');
        expect(input.props.autoCapitalize).toBe('none');
    });

    it('uses a phone keypad at the phone step', () => {
        renderBar({ currentStep: 'phone_collection' });

        expect(screen.getByTestId('chat-input').props.keyboardType).toBe('phone-pad');
    });

    it('uses a numeric keypad at the birth date step', () => {
        renderBar({ currentStep: 'birth_date_collection' });

        expect(['numeric', 'numbers-and-punctuation']).toContain(screen.getByTestId('chat-input').props.keyboardType);
    });

    it('masks entry at the password step', () => {
        renderBar({ currentStep: 'password_collection' });

        expect(screen.getByTestId('chat-input').props.secureTextEntry).toBe(true);
    });
});

describe('in-flight state (INPUT-05)', () => {
    it('disables the send control while a request is in flight', () => {
        renderBar({ pending: true });

        expect(screen.getByTestId('chat-send-button').props.accessibilityState.disabled).toBe(true);
        expect(screen.getByTestId('chat-input').props.editable).toBe(false);
    });

    it('does not submit a second turn while pending', () => {
        const { onSubmit } = renderBar({ pending: true });

        type('Alex Johnson');
        fireEvent(screen.getByTestId('chat-input'), 'submitEditing');

        expect(onSubmit).not.toHaveBeenCalled();
    });
});

describe('per-step validation blocks advance (INPUT-06 to INPUT-10)', () => {
    it.each([
        ['email_collection', 'invalid-email', 'valid email'],
        ['password_collection', 'weak', 'at least 8 characters'],
        ['birth_date_collection', '15-06-1990', 'YYYY-MM-DD'],
        ['phone_collection', 'invalid-phone', '7 to 15 digits'],
        ['name_provided', '<script>alert(1)</script>', 'cannot contain'],
    ])('at %s, rejects %s with an inline error and does not advance', (currentStep, value, expectedFragment) => {
        const { onSubmit } = renderBar({ currentStep });

        type(value);
        send();

        expect(onSubmit).not.toHaveBeenCalled();
        expect(errorText()).toContain(expectedFragment);
    });

    it('keeps the rejected text so the user can correct it', () => {
        renderBar({ currentStep: 'email_collection' });

        type('invalid-email');
        send();

        expect(screen.getByTestId('chat-input').props.value).toBe('invalid-email');
    });

    it('clears the error as soon as the user edits', () => {
        renderBar({ currentStep: 'email_collection' });

        type('invalid-email');
        send();
        expect(screen.getByTestId('chat-input-error')).toBeTruthy();

        type('valid.email@example.com');

        expect(screen.queryByTestId('chat-input-error')).toBeNull();
    });

    it('accepts a one-word name, since the missing part is defaulted (INPUT-10)', () => {
        const { onSubmit } = renderBar({ currentStep: 'name_provided' });

        type('Alex');
        send();

        expect(onSubmit).toHaveBeenCalledWith('Alex');
    });
});

describe('font scaling coverage (A11Y-14)', () => {
    it('caps every Text and TextInput at MAX_FONT_SCALE, including the validation error', () => {
        renderBar({ currentStep: 'email_collection' });
        type('invalid-email');
        send();
        // Sanity check that the error branch is actually mounted below, so this
        // test cannot silently pass by never reaching chat-input-error.
        expect(screen.getByTestId('chat-input-error')).toBeTruthy();

        [...screen.UNSAFE_getAllByType(Text), ...screen.UNSAFE_getAllByType(TextInput)].forEach((node) => {
            expect(node.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
        });
    });
});

describe('focus indicator on the input field (A11Y-13)', () => {
    it('shows a visibly thicker border once the field is focused', () => {
        renderBar();
        const restingStyle = StyleSheet.flatten(screen.getByTestId('chat-input').props.style);

        fireEvent(screen.getByTestId('chat-input'), 'focus');
        const focusedStyle = StyleSheet.flatten(screen.getByTestId('chat-input').props.style);

        expect(focusedStyle.borderWidth).toBeGreaterThan(restingStyle.borderWidth);
        expect(focusedStyle.borderColor).not.toBe(restingStyle.borderColor);
    });

    it('reverts to the resting border once the field loses focus', () => {
        renderBar();
        const restingStyle = StyleSheet.flatten(screen.getByTestId('chat-input').props.style);

        fireEvent(screen.getByTestId('chat-input'), 'focus');
        fireEvent(screen.getByTestId('chat-input'), 'blur');

        expect(StyleSheet.flatten(screen.getByTestId('chat-input').props.style)).toEqual(restingStyle);
    });
});

describe('focus indicator on the send button (A11Y-13)', () => {
    it('adds a visible border once focused, where none exists at rest', () => {
        renderBar();
        const restingStyle = StyleSheet.flatten(screen.getByTestId('chat-send-button').props.style);
        expect(restingStyle.borderWidth).toBeFalsy();

        fireEvent(screen.getByTestId('chat-send-button'), 'focus');

        const focusedStyle = StyleSheet.flatten(screen.getByTestId('chat-send-button').props.style);
        expect(focusedStyle.borderWidth).toBeGreaterThan(0);
        expect(focusedStyle.borderColor).toBeTruthy();
    });

    it('reverts to the resting style once focus is lost', () => {
        renderBar();
        const restingStyle = StyleSheet.flatten(screen.getByTestId('chat-send-button').props.style);

        fireEvent(screen.getByTestId('chat-send-button'), 'focus');
        fireEvent(screen.getByTestId('chat-send-button'), 'blur');

        expect(StyleSheet.flatten(screen.getByTestId('chat-send-button').props.style)).toEqual(restingStyle);
    });

    it('still disables the button while pending, even if it was focused first', () => {
        renderBar({ pending: true });

        fireEvent(screen.getByTestId('chat-send-button'), 'focus');

        expect(screen.getByTestId('chat-send-button').props.accessibilityState.disabled).toBe(true);
    });
});

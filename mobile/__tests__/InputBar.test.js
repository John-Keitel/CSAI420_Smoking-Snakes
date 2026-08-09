import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import InputBar, { KEYBOARD_BEHAVIOR } from '../app/components/chat/InputBar';
import { messageSent } from '../app/lib/hapticController';

jest.mock('../app/lib/hapticController', () => ({
    messageSent: jest.fn(),
}));

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

describe('haptic feedback on send (HAPTIC-01)', () => {
    // beforeEach, not afterEach: earlier describes in this file also call
    // send(), which now also fires messageSent - clearing only after this
    // block's own tests would leave those earlier calls counted here too.
    beforeEach(() => {
        messageSent.mockClear();
    });

    it('fires once a message actually sends', () => {
        renderBar();

        type('Alex Johnson');
        send();

        expect(messageSent).toHaveBeenCalledTimes(1);
    });

    it('does not fire when validation rejects the input', () => {
        renderBar({ currentStep: 'email_collection' });

        type('invalid-email');
        send();

        expect(messageSent).not.toHaveBeenCalled();
    });

    it('does not fire for an empty draft', () => {
        renderBar();

        type('   ');
        send();

        expect(messageSent).not.toHaveBeenCalled();
    });
});

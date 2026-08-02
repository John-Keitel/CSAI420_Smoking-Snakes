import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { createChatSessionId, MAX_CHAT_SESSION_ID_LENGTH } from '../app/lib/session';
import SignUpScreen from '../app/screens/SignUpScreen';

// `screen` is a live binding, so these must be ESM imports -- destructuring it
// from a CJS require captures the pre-render placeholder.
jest.mock('../app/lib/session', () => {
    let counter = 0;

    return {
        MAX_CHAT_SESSION_ID_LENGTH: 128,
        createChatSessionId: jest.fn(() => `session-${++counter}`),
    };
});

// This suite owns the entry point, not the conversation; ChatSheet has its own.
jest.mock('../app/api/chatClient', () => ({
    continueSession: jest.fn(() => new Promise(() => {})),
    registerChatAssisted: jest.fn(),
}));

afterEach(() => {
    jest.clearAllMocks();
});

describe('Need Help? entry point', () => {
    it('renders the control on the signup screen (HELP-01)', () => {
        render(<SignUpScreen />);

        expect(screen.getByTestId('need-help-button')).toBeTruthy();
        expect(screen.getByText('Need Help?')).toBeTruthy();
    });

    it('does not present the chat surface before it is activated (HELP-02)', () => {
        render(<SignUpScreen />);

        // A hidden RN Modal renders nothing at all, so absence is the assertion.
        expect(screen.queryByTestId('chat-sheet')).toBeNull();
    });

    it('presents the chat surface when activated (HELP-03)', () => {
        render(<SignUpScreen />);

        fireEvent.press(screen.getByTestId('need-help-button'));

        expect(screen.getByTestId('chat-sheet')).toBeTruthy();
        expect(screen.getByTestId('chat-sheet').props.visible).toBe(true);
    });

    it('mints a fresh session id on every opening (HELP-04)', () => {
        render(<SignUpScreen />);

        fireEvent.press(screen.getByTestId('need-help-button'));
        fireEvent.press(screen.getByTestId('chat-close-button'));
        fireEvent.press(screen.getByTestId('need-help-button'));

        expect(createChatSessionId).toHaveBeenCalledTimes(2);

        const [first, second] = createChatSessionId.mock.results.map((result) => result.value);
        expect(first).not.toBe(second);
        expect(second.length).toBeLessThanOrEqual(MAX_CHAT_SESSION_ID_LENGTH);
    });

    it('dismisses the surface when the close control is used', () => {
        render(<SignUpScreen />);

        fireEvent.press(screen.getByTestId('need-help-button'));
        fireEvent.press(screen.getByTestId('chat-close-button'));

        expect(screen.queryByTestId('chat-sheet')).toBeNull();
    });

    it('gives the control a touch target of at least 44x44 (HELP-05)', () => {
        render(<SignUpScreen />);

        const style = StyleSheet.flatten(screen.getByTestId('need-help-button').props.style);

        expect(style.minHeight).toBeGreaterThanOrEqual(44);
        expect(style.minWidth).toBeGreaterThanOrEqual(44);
    });

    it('labels the control for screen readers', () => {
        render(<SignUpScreen />);

        const control = screen.getByTestId('need-help-button');

        expect(control.props.accessibilityRole).toBe('button');
        expect(control.props.accessibilityLabel).toEqual(expect.any(String));
        expect(control.props.accessibilityLabel.length).toBeGreaterThan(0);
    });
});

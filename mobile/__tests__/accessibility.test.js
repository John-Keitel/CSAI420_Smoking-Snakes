import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { continueSession, registerChatAssisted } from '../app/api/chatClient';
import ChatSheet from '../app/components/chat/ChatSheet';
import MessageList from '../app/components/chat/MessageList';
import { MAX_FONT_SCALE } from '../app/components/Styles';
import SignUpScreen from '../app/screens/SignUpScreen';

jest.mock('../app/api/chatClient', () => ({
    continueSession: jest.fn(),
    registerChatAssisted: jest.fn(),
}));

// react-test-renderer has no real native view hierarchy, so the actual
// findNodeHandle always resolves undefined here even though it resolves a
// real tag on device. `react-native`'s own `findNodeHandle` export is a
// getter that re-requires this leaf module on every access, so mocking it
// here (rather than the whole `react-native` package, which would also drag
// in native-only modules like DevMenu) reaches every caller, including
// ChatSheet, without disturbing anything else react-native provides.
jest.mock('react-native/Libraries/ReactNative/RendererProxy', () => {
    const actual = jest.requireActual('react-native/Libraries/ReactNative/RendererProxy');

    return { ...actual, findNodeHandle: jest.fn(() => 1) };
});

const FIRST_PROMPT = "I'd be happy to help! What's your name?";

const openerTurn = () => ({
    ok: true,
    response: FIRST_PROMPT,
    conversationContext: [
        { role: 'user', message: 'I need help signing up' },
        { role: 'assistant', message: FIRST_PROMPT },
    ],
    nextStep: 'name_provided',
});

beforeEach(() => {
    continueSession.mockResolvedValue(openerTurn());
    registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'u1' } });
    jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'setAccessibilityFocus').mockImplementation(() => {});
});

afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
});

const openSheet = async () => {
    render(<SignUpScreen />);
    fireEvent.press(screen.getByTestId('need-help-button'));
    await screen.findByText(FIRST_PROMPT);
};

describe('every control is labelled (A11Y-01)', () => {
    it('labels the entry point', () => {
        render(<SignUpScreen />);

        expect(screen.getByLabelText('Need help? Sign up by chat instead')).toBeTruthy();
    });

    it.each([
        ['Close the sign up assistant'],
        ['Your reply'],
        ['Send reply'],
    ])('labels %s inside the sheet', async (label) => {
        await openSheet();

        expect(screen.getByLabelText(label, { includeHiddenElements: true })).toBeTruthy();
    });

    it('gives every interactive control a role', async () => {
        await openSheet();

        ['chat-close-button', 'chat-send-button'].forEach((testID) => {
            expect(screen.getByTestId(testID).props.accessibilityRole).toBe('button');
        });
    });
});

describe('speaker identification (A11Y-02)', () => {
    it('distinguishes the assistant from the user', async () => {
        await openSheet();

        expect(screen.getByTestId('chat-message-0').props.accessibilityLabel).toBe('You said: I need help signing up');
        expect(screen.getByTestId('chat-message-1').props.accessibilityLabel).toBe(`Assistant said: ${FIRST_PROMPT}`);
    });
});

describe('announcing replies (A11Y-03)', () => {
    it('announces a new assistant reply', () => {
        render(<MessageList entries={[{ role: 'assistant', message: FIRST_PROMPT }]} />);

        expect(AccessibilityInfo.announceForAccessibility).toHaveBeenCalledWith(FIRST_PROMPT);
    });

    it('announces each new reply as the conversation advances', () => {
        const first = [{ role: 'assistant', message: FIRST_PROMPT }];
        const { rerender } = render(<MessageList entries={first} />);

        rerender(
            <MessageList
                entries={[...first, { role: 'user', message: 'Alex' }, { role: 'assistant', message: 'Great! What is your email address?' }]}
            />
        );

        expect(AccessibilityInfo.announceForAccessibility).toHaveBeenLastCalledWith('Great! What is your email address?');
    });

    it('does not announce the user echoing their own turn', () => {
        render(
            <MessageList
                entries={[
                    { role: 'assistant', message: FIRST_PROMPT },
                    { role: 'user', message: 'Alex Johnson' },
                ]}
            />
        );

        expect(AccessibilityInfo.announceForAccessibility).not.toHaveBeenCalledWith('Alex Johnson');
    });

    it('marks the transcript as a polite live region', async () => {
        await openSheet();

        expect(screen.getByTestId('chat-transcript').props.accessibilityLiveRegion).toBe('polite');
    });
});

describe('dynamic font scaling (A11Y-04, A11Y-05)', () => {
    it('caps scaling rather than disabling it', async () => {
        await openSheet();

        // allowFontScaling is never set to false anywhere; only the multiplier is bounded.
        const bubble = screen.getByTestId('chat-message-1').findByType('Text');
        expect(bubble.props.allowFontScaling).not.toBe(false);
        expect(bubble.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    });

    it('bounds the input and its send control too', async () => {
        await openSheet();

        expect(screen.getByTestId('chat-input').props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
        expect(screen.getByTestId('chat-send-button').findByType('Text').props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
    });

    it('lets bubbles grow vertically instead of clipping', async () => {
        await openSheet();

        const bubble = screen.getByTestId('chat-message-1').findByType('Text');
        // No fixed height and no line cap, so scaled text reflows rather than being cut off.
        expect(bubble.props.numberOfLines).toBeUndefined();
        expect(bubble.props.style.height).toBeUndefined();
    });
});

describe('modal isolation (A11Y-06)', () => {
    it('declares the sheet as a modal so content behind is not reachable', async () => {
        await openSheet();

        // accessibilityViewIsModal is the mechanism that takes siblings out of the
        // accessibility tree; RNTL honours it, which is why the backdrop below
        // needs includeHiddenElements to be found at all.
        expect(screen.getByTestId('chat-sheet-surface').props.accessibilityViewIsModal).toBe(true);
        expect(screen.queryByTestId('chat-backdrop')).toBeNull();
        expect(screen.getByTestId('chat-backdrop', { includeHiddenElements: true })).toBeTruthy();
    });
});

/**
 * Registration only fires from a sent turn, so the opener is mocked to land on
 * the password step and the next turn completes the conversation.
 */
async function completeViaOneTurn(renderTree) {
    const passwordPrompt = 'Almost done! Please choose a password.';
    const history = [{ role: 'assistant', message: passwordPrompt }];

    continueSession.mockResolvedValueOnce({
        ok: true,
        response: passwordPrompt,
        conversationContext: history,
        nextStep: 'password_collection',
    });

    renderTree();
    await screen.findByText(passwordPrompt);

    continueSession.mockResolvedValueOnce({
        ok: true,
        response: 'Ready to finish? Let me create your account.',
        conversationContext: [
            ...history,
            { role: 'user', message: 'Str0ngP@ssw0rd!' },
            { role: 'assistant', message: 'Ready to finish? Let me create your account.' },
        ],
        nextStep: 'completion',
    });

    fireEvent.changeText(screen.getByTestId('chat-input'), 'Str0ngP@ssw0rd!');
    fireEvent.press(screen.getByTestId('chat-send-button'));

    await waitFor(() => expect(registerChatAssisted).toHaveBeenCalled());
}

describe('reporting accessibility mode (A11Y-07)', () => {
    it('sends screen-reader mode when a screen reader is active', async () => {
        AccessibilityInfo.isScreenReaderEnabled.mockResolvedValue(true);

        await completeViaOneTurn(() => {
            render(<SignUpScreen />);
            fireEvent.press(screen.getByTestId('need-help-button'));
        });

        expect(registerChatAssisted.mock.calls[0][0].accessibilityMode).toBe('screen-reader');
    });

    it('omits the field when no screen reader is active', async () => {
        await completeViaOneTurn(() => {
            render(<SignUpScreen />);
            fireEvent.press(screen.getByTestId('need-help-button'));
        });

        expect(registerChatAssisted.mock.calls[0][0]).not.toHaveProperty('accessibilityMode');
    });

    it('passes an explicit mode straight through', async () => {
        await completeViaOneTurn(() => {
            render(<ChatSheet visible chatSessionId="session-1" onDismiss={jest.fn()} accessibilityMode="screen-reader" />);
        });

        expect(registerChatAssisted.mock.calls[0][0].accessibilityMode).toBe('screen-reader');
    });
});

describe('moving focus into the sheet on open (A11Y-08)', () => {
    it('moves screen reader focus once the sheet opens', async () => {
        await openSheet();

        expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalled();
    });

    it('does not move focus while the sheet is hidden', () => {
        render(<SignUpScreen />);

        expect(AccessibilityInfo.setAccessibilityFocus).not.toHaveBeenCalled();
    });
});

describe('restoring focus to the trigger on dismiss (A11Y-09)', () => {
    it('returns screen reader focus to the Need Help control after the close button is used', async () => {
        await openSheet();
        AccessibilityInfo.setAccessibilityFocus.mockClear(); // discard the A11Y-08 call from opening

        fireEvent.press(screen.getByTestId('chat-close-button'));

        expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalled();
    });

    it('returns screen reader focus to the Need Help control after the backdrop is used', async () => {
        await openSheet();
        AccessibilityInfo.setAccessibilityFocus.mockClear();

        fireEvent.press(screen.getByTestId('chat-backdrop', { includeHiddenElements: true }));

        expect(AccessibilityInfo.setAccessibilityFocus).toHaveBeenCalled();
    });
});

describe('hiding the background from TalkBack while the sheet is open (A11Y-10)', () => {
    it('leaves the form reachable before the sheet opens', () => {
        render(<SignUpScreen />);

        expect(screen.getByTestId('signup-scroll').props.importantForAccessibility).toBe('auto');
    });

    it('hides the form from TalkBack once the sheet opens', async () => {
        await openSheet();

        // `no-hide-descendants` takes the whole subtree out of the accessibility
        // tree, so RNTL treats it the same as a hidden element.
        expect(screen.getByTestId('signup-scroll', { includeHiddenElements: true }).props.importantForAccessibility).toBe(
            'no-hide-descendants'
        );
    });

    it('makes the form reachable again once the sheet is dismissed', async () => {
        await openSheet();

        fireEvent.press(screen.getByTestId('chat-close-button'));

        expect(screen.getByTestId('signup-scroll').props.importantForAccessibility).toBe('auto');
    });
});

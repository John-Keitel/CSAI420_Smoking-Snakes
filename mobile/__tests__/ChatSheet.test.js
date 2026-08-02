import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { continueSession } from '../app/api/chatClient';
import ChatSheet, { OPENER_MESSAGE } from '../app/components/chat/ChatSheet';

jest.mock('../app/api/chatClient', () => ({
    continueSession: jest.fn(),
    registerChatAssisted: jest.fn(),
}));

const FIRST_PROMPT = "I'd be happy to help! What's your name?";

const turn = (userMessage, assistantMessage, nextStep, history = []) => ({
    ok: true,
    response: assistantMessage,
    conversationContext: [
        ...history,
        { role: 'user', message: userMessage },
        { role: 'assistant', message: assistantMessage },
    ],
    nextStep,
});

const openerTurn = () => turn(OPENER_MESSAGE, FIRST_PROMPT, 'name_provided');

const renderSheet = (props = {}) =>
    render(<ChatSheet visible chatSessionId="session-1" onDismiss={jest.fn()} {...props} />);

afterEach(() => {
    jest.clearAllMocks();
});

describe('presentation and dismissal', () => {
    it('presents as a transparent modal over the screen (SHEET-01)', async () => {
        continueSession.mockResolvedValue(openerTurn());

        renderSheet();
        await screen.findByText(FIRST_PROMPT);

        const modal = screen.getByTestId('chat-sheet');
        expect(modal.props.visible).toBe(true);
        expect(modal.props.transparent).toBe(true);
    });

    it.each([
        ['close control', 'chat-close-button'],
        ['backdrop', 'chat-backdrop'],
    ])('dismisses via the %s (SHEET-03)', async (_label, testID) => {
        continueSession.mockResolvedValue(openerTurn());
        const onDismiss = jest.fn();

        renderSheet({ onDismiss });
        await screen.findByText(FIRST_PROMPT);

        fireEvent.press(screen.getByTestId(testID));

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses on the Android back button (SHEET-03)', async () => {
        continueSession.mockResolvedValue(openerTurn());
        const onDismiss = jest.fn();

        renderSheet({ onDismiss });
        await screen.findByText(FIRST_PROMPT);

        screen.getByTestId('chat-sheet').props.onRequestClose();

        expect(onDismiss).toHaveBeenCalledTimes(1);
    });
});

describe('opening the conversation (SHEET-02)', () => {
    it('sends an opener and renders the first assistant prompt', async () => {
        continueSession.mockResolvedValue(openerTurn());

        renderSheet();

        expect(await screen.findByText(FIRST_PROMPT)).toBeTruthy();
        expect(continueSession).toHaveBeenCalledWith({
            chatSessionId: 'session-1',
            message: OPENER_MESSAGE,
            context: 'initial_greeting',
        });
    });

    it('does not open a session while hidden', () => {
        continueSession.mockResolvedValue(openerTurn());

        renderSheet({ visible: false });

        expect(continueSession).not.toHaveBeenCalled();
    });
});

describe('advancing a turn (SHEET-04)', () => {
    it('sends the next turn against the step the session is currently in', async () => {
        continueSession.mockResolvedValueOnce(openerTurn());
        renderSheet();
        await screen.findByText(FIRST_PROMPT);

        continueSession.mockResolvedValueOnce(
            turn('Alex Johnson', 'Great! What is your email address?', 'email_collection', openerTurn().conversationContext)
        );

        fireEvent.changeText(screen.getByTestId('chat-input'), 'Alex Johnson');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        await waitFor(() => {
            expect(continueSession).toHaveBeenLastCalledWith({
                chatSessionId: 'session-1',
                message: 'Alex Johnson',
                // The opener returned nextStep 'name_provided', so the answer to
                // "What's your name?" is sent against that step.
                context: 'name_provided',
            });
        });
    });

    it('renders the growing transcript', async () => {
        continueSession.mockResolvedValueOnce(openerTurn());
        renderSheet();
        await screen.findByText(FIRST_PROMPT);

        continueSession.mockResolvedValueOnce(
            turn('Alex Johnson', 'Great! What is your email address?', 'email_collection', openerTurn().conversationContext)
        );

        fireEvent.changeText(screen.getByTestId('chat-input'), 'Alex Johnson');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        expect(await screen.findByText('Alex Johnson')).toBeTruthy();
        expect(screen.getByText('Great! What is your email address?')).toBeTruthy();
    });

    it('ignores an empty draft', async () => {
        continueSession.mockResolvedValue(openerTurn());
        renderSheet();
        await screen.findByText(FIRST_PROMPT);

        fireEvent.changeText(screen.getByTestId('chat-input'), '   ');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        expect(continueSession).toHaveBeenCalledTimes(1);
    });

    it('masks the credential turn by index, never rendering the typed password', async () => {
        const history = [{ role: 'assistant', message: 'Almost done! Please choose a password.' }];
        continueSession.mockResolvedValueOnce({
            ok: true,
            response: 'Almost done! Please choose a password.',
            conversationContext: history,
            nextStep: 'password_collection',
        });

        renderSheet();
        await screen.findByText('Almost done! Please choose a password.');

        continueSession.mockResolvedValueOnce(
            turn('Str0ngP@ssw0rd!', 'Ready to finish? Let me create your account.', 'completion', history)
        );

        fireEvent.changeText(screen.getByTestId('chat-input'), 'Str0ngP@ssw0rd!');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        await screen.findByText('Ready to finish? Let me create your account.');

        expect(screen.queryByText('Str0ngP@ssw0rd!')).toBeNull();
        expect(screen.getByText('••••••••')).toBeTruthy();
    });
});

describe('failure handling', () => {
    it('surfaces a network failure and stays retryable (SHEET-05)', async () => {
        continueSession.mockResolvedValue({ ok: false, kind: 'failed', status: null });

        renderSheet();

        await screen.findByTestId('chat-error');
        // The send control must not be left disabled behind a stuck spinner.
        expect(screen.getByTestId('chat-send-button').props.accessibilityState.disabled).toBe(false);
    });

    it('renders the errors returned on a 400 rather than a generic message (SHEET-06)', async () => {
        continueSession.mockResolvedValue({
            ok: false,
            kind: 'invalid',
            errors: ['chatSessionId: chatSessionId is required'],
        });

        renderSheet();

        expect(await screen.findByText('chatSessionId: chatSessionId is required')).toBeTruthy();
    });

    it('clears a previous error when the next turn succeeds', async () => {
        continueSession.mockResolvedValueOnce({ ok: false, kind: 'failed', status: 500 });
        renderSheet();
        await screen.findByTestId('chat-error');

        continueSession.mockResolvedValueOnce(openerTurn());
        fireEvent.changeText(screen.getByTestId('chat-input'), 'hello');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        await waitFor(() => {
            expect(screen.queryByTestId('chat-error')).toBeNull();
        });
    });
});

describe('reopening (SHEET-07)', () => {
    it('starts a fresh conversation when a new session id arrives', async () => {
        continueSession.mockResolvedValue(openerTurn());

        const { rerender } = renderSheet();
        await screen.findByText(FIRST_PROMPT);

        continueSession.mockResolvedValue(
            turn(OPENER_MESSAGE, FIRST_PROMPT, 'name_provided')
        );

        rerender(<ChatSheet visible chatSessionId="session-2" onDismiss={jest.fn()} />);

        await waitFor(() => {
            expect(continueSession).toHaveBeenLastCalledWith({
                chatSessionId: 'session-2',
                message: OPENER_MESSAGE,
                context: 'initial_greeting',
            });
        });

        // One opener per session, and the transcript restarts from it.
        expect(screen.getAllByText(FIRST_PROMPT)).toHaveLength(1);
    });
});

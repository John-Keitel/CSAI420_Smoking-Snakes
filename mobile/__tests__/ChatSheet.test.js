import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { continueSession, registerChatAssisted } from '../app/api/chatClient';
import ChatSheet, { OPENER_MESSAGE } from '../app/components/chat/ChatSheet';

jest.mock('../app/api/chatClient', () => ({
    continueSession: jest.fn(),
    registerChatAssisted: jest.fn(),
}));

const FIRST_PROMPT = "I'd be happy to help! What's your name?";

// RNTL's toHaveTextContent is an exact match for strings, so partial assertions
// read the Text node's single string child directly.
const textOf = (testID) => screen.getByTestId(testID).props.children;

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

beforeEach(() => {
    registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'default-user' } });
});

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

        fireEvent.press(screen.getByTestId(testID, { includeHiddenElements: true }));

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

// The six prompts the server returns, in order. Walking the whole flow is the
// only way to prove the step-to-field mapping end to end.
const FLOW = [
    { nextStep: 'name_provided', prompt: "I'd be happy to help! What's your name?" },
    { nextStep: 'email_collection', prompt: 'Great! What is your email address?' },
    { nextStep: 'phone_collection', prompt: 'Thanks! What is your phone number?' },
    { nextStep: 'birth_date_collection', prompt: "Perfect. What's your date of birth?" },
    { nextStep: 'password_collection', prompt: 'Almost done! Please choose a password.' },
    { nextStep: 'completion', prompt: 'Ready to finish? Let me create your account.' },
];

const ANSWERS = ['Alex Johnson', 'alex@example.com', '8014567890', '1990-06-15', 'Str0ngP@ssw0rd!'];

function mockFlow() {
    let history = [];
    let turnIndex = 0;

    continueSession.mockImplementation(async ({ message }) => {
        const step = FLOW[turnIndex];
        turnIndex += 1;
        history = [...history, { role: 'user', message }, { role: 'assistant', message: step.prompt }];

        return { ok: true, response: step.prompt, conversationContext: history, nextStep: step.nextStep };
    });
}

async function walkToCompletion(props = {}) {
    mockFlow();
    const onRegistered = jest.fn();
    const utils = render(<ChatSheet visible chatSessionId="session-1" onDismiss={jest.fn()} onRegistered={onRegistered} {...props} />);

    await screen.findByText(FLOW[0].prompt);

    for (let index = 0; index < ANSWERS.length; index += 1) {
        fireEvent.changeText(screen.getByTestId('chat-input'), ANSWERS[index]);
        fireEvent.press(screen.getByTestId('chat-send-button'));
        await screen.findByText(FLOW[index + 1].prompt);
    }

    return { ...utils, onRegistered };
}

describe('completing registration (INPUT-11, INPUT-15)', () => {
    it('posts the accumulated answers to the right fields', async () => {
        registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'u1', email: 'alex@example.com' } });

        await walkToCompletion();

        await waitFor(() => expect(registerChatAssisted).toHaveBeenCalledTimes(1));

        const payload = registerChatAssisted.mock.calls[0][0];
        expect(payload.userData).toEqual({
            email: 'alex@example.com',
            password: 'Str0ngP@ssw0rd!',
            birthDate: '1990-06-15',
            phone: '8014567890',
            firstName: 'Alex',
            lastName: 'Johnson',
        });
        expect(payload.chatSessionId).toBe('session-1');
    });

    it('reports the created user so the screen can confirm it', async () => {
        registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'u1', email: 'alex@example.com' } });

        const { onRegistered } = await walkToCompletion();

        await waitFor(() => expect(onRegistered).toHaveBeenCalledWith({ id: 'u1', email: 'alex@example.com' }));
    });

    it('withholds the credential turn from the conversation log (INPUT-15)', async () => {
        registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'u1' } });

        await walkToCompletion();

        await waitFor(() => expect(registerChatAssisted).toHaveBeenCalled());

        const { conversationLog } = registerChatAssisted.mock.calls[0][0];
        expect(conversationLog.some((entry) => entry.message === 'Str0ngP@ssw0rd!')).toBe(false);
        expect(conversationLog.some((entry) => entry.message === 'alex@example.com')).toBe(true);
    });

    it('sends the real last-activity timestamp, not the moment of submission', async () => {
        registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'u1' } });

        await walkToCompletion();

        await waitFor(() => expect(registerChatAssisted).toHaveBeenCalled());

        const { lastActivity } = registerChatAssisted.mock.calls[0][0];
        expect(typeof lastActivity).toBe('string');
        expect(Number.isNaN(Date.parse(lastActivity))).toBe(false);
    });

    it('does not register until the conversation reaches completion', async () => {
        registerChatAssisted.mockResolvedValue({ ok: true, user: { id: 'u1' } });
        mockFlow();

        render(<ChatSheet visible chatSessionId="session-1" onDismiss={jest.fn()} />);
        await screen.findByText(FLOW[0].prompt);

        fireEvent.changeText(screen.getByTestId('chat-input'), 'Alex Johnson');
        fireEvent.press(screen.getByTestId('chat-send-button'));
        await screen.findByText(FLOW[1].prompt);

        expect(registerChatAssisted).not.toHaveBeenCalled();
    });
});

describe('duplicate email (INPUT-12)', () => {
    it('keeps the session and lets the user supply a different email', async () => {
        registerChatAssisted.mockResolvedValueOnce({ ok: false, kind: 'duplicate', message: 'Email already registered' });

        await walkToCompletion();

        await screen.findByTestId('chat-error');
        expect(textOf('chat-error')).toContain('Email already registered');
        // The transcript survives the rejection.
        expect(screen.getByText('Alex Johnson')).toBeTruthy();

        registerChatAssisted.mockResolvedValueOnce({ ok: true, user: { id: 'u2', email: 'other@example.com' } });

        fireEvent.changeText(screen.getByTestId('chat-input'), 'other@example.com');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        await waitFor(() => expect(registerChatAssisted).toHaveBeenCalledTimes(2));

        // Retrying replaces only the email; it does not advance the conversation.
        expect(registerChatAssisted.mock.calls[1][0].userData.email).toBe('other@example.com');
        expect(registerChatAssisted.mock.calls[1][0].userData.password).toBe('Str0ngP@ssw0rd!');
    });

    it('validates the replacement email against the email rules', async () => {
        registerChatAssisted.mockResolvedValueOnce({ ok: false, kind: 'duplicate', message: 'Email already registered' });

        await walkToCompletion();
        await screen.findByTestId('chat-error');

        fireEvent.changeText(screen.getByTestId('chat-input'), 'still-not-an-email');
        fireEvent.press(screen.getByTestId('chat-send-button'));

        expect(textOf('chat-input-error')).toContain('valid email');
        expect(registerChatAssisted).toHaveBeenCalledTimes(1);
    });
});

describe('expired session (INPUT-13)', () => {
    it('offers a restart instead of a dead sheet', async () => {
        registerChatAssisted.mockResolvedValue({ ok: false, kind: 'expired', message: 'Chat session has expired' });
        const onRestart = jest.fn();

        await walkToCompletion({ onRestart });

        expect(await screen.findByTestId('chat-restart-button')).toBeTruthy();
        expect(textOf('chat-error')).toContain('Chat session has expired');
        expect(screen.queryByTestId('chat-input')).toBeNull();

        fireEvent.press(screen.getByTestId('chat-restart-button'));
        expect(onRestart).toHaveBeenCalledTimes(1);
    });
});

describe('invalid registration payload (INPUT-14)', () => {
    it('renders the errors the API returned', async () => {
        registerChatAssisted.mockResolvedValue({
            ok: false,
            kind: 'invalid',
            errors: ['userData.phone: phone must be a valid phone number'],
        });

        await walkToCompletion();

        expect(await screen.findByText('userData.phone: phone must be a valid phone number')).toBeTruthy();
    });
});

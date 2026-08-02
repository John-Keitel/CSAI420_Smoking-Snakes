const { continueSession, getApiBaseUrl, registerChatAssisted } = require('../app/api/chatClient');

const jsonResponse = (status, body) => ({ status, json: async () => body });

beforeEach(() => {
    global.fetch = jest.fn();
});

afterEach(() => {
    jest.clearAllMocks();
});

describe('getApiBaseUrl', () => {
    it('reads the host from Expo config', () => {
        expect(getApiBaseUrl()).toBe('https://api.test');
    });

    it('strips trailing slashes so paths do not double up', () => {
        jest.resetModules();
        jest.doMock('expo-constants', () => ({
            __esModule: true,
            default: { expoConfig: { extra: { apiBaseUrl: 'https://api.test///' } } },
        }));

        const isolated = require('../app/api/chatClient');
        expect(isolated.getApiBaseUrl()).toBe('https://api.test');

        jest.dontMock('expo-constants');
        jest.resetModules();
    });

    it('throws an explicit configuration error when apiBaseUrl is missing (FND-05)', () => {
        jest.resetModules();
        jest.doMock('expo-constants', () => ({
            __esModule: true,
            default: { expoConfig: { extra: {} } },
        }));

        const isolated = require('../app/api/chatClient');
        expect(() => isolated.getApiBaseUrl()).toThrow(/apiBaseUrl is not configured/);

        jest.dontMock('expo-constants');
        jest.resetModules();
    });
});

describe('continueSession (FND-03)', () => {
    it('posts to /chat/continue-session with a JSON content type and no /api prefix', async () => {
        global.fetch.mockResolvedValue(
            jsonResponse(200, {
                response: "I'd be happy to help! What's your name?",
                conversationContext: [{ role: 'assistant', message: 'hi' }],
                nextStep: 'name_provided',
                sessionActive: true,
            })
        );

        await continueSession({ chatSessionId: 'session-1', message: 'I need help signing up' });

        const [url, options] = global.fetch.mock.calls[0];
        expect(url).toBe('https://api.test/chat/continue-session');
        expect(options.method).toBe('POST');
        expect(options.headers['Content-Type']).toBe('application/json');
        expect(JSON.parse(options.body)).toEqual({
            chatSessionId: 'session-1',
            message: 'I need help signing up',
        });
    });

    it('returns the parsed turn on 200', async () => {
        global.fetch.mockResolvedValue(
            jsonResponse(200, {
                response: 'Great! What is your email address?',
                conversationContext: [{ role: 'user', message: 'Alex Johnson' }],
                nextStep: 'email_collection',
                sessionActive: true,
            })
        );

        const result = await continueSession({ chatSessionId: 'session-1', message: 'Alex Johnson' });

        expect(result).toEqual({
            ok: true,
            response: 'Great! What is your email address?',
            conversationContext: [{ role: 'user', message: 'Alex Johnson' }],
            nextStep: 'email_collection',
        });
    });

    it('includes context only when supplied', async () => {
        global.fetch.mockResolvedValue(jsonResponse(200, { response: 'x', conversationContext: [], nextStep: 'completion' }));

        await continueSession({ chatSessionId: 'session-1', message: 'hi', context: 'email_collection' });

        expect(JSON.parse(global.fetch.mock.calls[0][1].body).context).toBe('email_collection');
    });

    it('maps 400 to an invalid outcome carrying errors', async () => {
        global.fetch.mockResolvedValue(jsonResponse(400, { errors: ['chatSessionId: chatSessionId is required'] }));

        const result = await continueSession({ chatSessionId: '', message: 'hi' });

        expect(result).toEqual({ ok: false, kind: 'invalid', errors: ['chatSessionId: chatSessionId is required'] });
    });

    it('maps 500 to a failed outcome', async () => {
        global.fetch.mockResolvedValue(jsonResponse(500, { error: 'Server Error' }));

        expect(await continueSession({ chatSessionId: 's', message: 'hi' })).toEqual({
            ok: false,
            kind: 'failed',
            status: 500,
        });
    });

    it('maps a network failure to a failed outcome rather than throwing', async () => {
        global.fetch.mockRejectedValue(new TypeError('Network request failed'));

        expect(await continueSession({ chatSessionId: 's', message: 'hi' })).toEqual({
            ok: false,
            kind: 'failed',
            status: null,
        });
    });
});

describe('registerChatAssisted (FND-04)', () => {
    const payload = {
        userData: {
            email: 'alex@example.com',
            password: 'Str0ngP@ssw0rd!',
            birthDate: '1990-06-15',
            firstName: 'Alex',
            lastName: 'Johnson',
        },
        chatSessionId: 'session-1',
    };

    it('posts to /user/chat-assisted with no /api prefix', async () => {
        global.fetch.mockResolvedValue(jsonResponse(201, { user: { id: 'u1' }, message: 'ok' }));

        await registerChatAssisted(payload);

        expect(global.fetch.mock.calls[0][0]).toBe('https://api.test/user/chat-assisted');
    });

    it('returns the created user on 201', async () => {
        global.fetch.mockResolvedValue(
            jsonResponse(201, {
                user: { id: 'u1', email: 'alex@example.com' },
                message: 'Account created successfully via chat assistant!',
            })
        );

        const result = await registerChatAssisted(payload);

        expect(result.ok).toBe(true);
        expect(result.user).toEqual({ id: 'u1', email: 'alex@example.com' });
    });

    it('distinguishes 400 as invalid', async () => {
        global.fetch.mockResolvedValue(jsonResponse(400, { errors: ['email: must be a valid email address'], requiresChat: true }));

        expect(await registerChatAssisted(payload)).toEqual({
            ok: false,
            kind: 'invalid',
            errors: ['email: must be a valid email address'],
        });
    });

    it('distinguishes 408 as expired', async () => {
        global.fetch.mockResolvedValue(jsonResponse(408, { message: 'Chat session has expired' }));

        expect(await registerChatAssisted(payload)).toEqual({
            ok: false,
            kind: 'expired',
            message: 'Chat session has expired',
        });
    });

    it('distinguishes 409 as duplicate', async () => {
        global.fetch.mockResolvedValue(jsonResponse(409, { error: 'Email already registered' }));

        expect(await registerChatAssisted(payload)).toEqual({
            ok: false,
            kind: 'duplicate',
            message: 'Email already registered',
        });
    });

    it('falls back to failed for any other status', async () => {
        global.fetch.mockResolvedValue(jsonResponse(500, { error: 'Server Error' }));

        expect(await registerChatAssisted(payload)).toEqual({ ok: false, kind: 'failed', status: 500 });
    });

    it('does not throw when the body is not JSON', async () => {
        global.fetch.mockResolvedValue({
            status: 500,
            json: async () => {
                throw new SyntaxError('Unexpected token');
            },
        });

        expect(await registerChatAssisted(payload)).toEqual({ ok: false, kind: 'failed', status: 500 });
    });
});

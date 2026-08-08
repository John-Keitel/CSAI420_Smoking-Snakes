import AsyncStorage from '@react-native-async-storage/async-storage';

import { clear, isExpired, load, save, SESSION_TTL_MS } from '../app/lib/sessionStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
    setItem: jest.fn(),
    getItem: jest.fn(),
    removeItem: jest.fn(),
}));

beforeEach(() => {
    AsyncStorage.setItem.mockReset();
    AsyncStorage.getItem.mockReset();
    AsyncStorage.removeItem.mockReset();
});

afterEach(() => {
    jest.clearAllMocks();
});

const baseState = {
    currentStep: 'email_collection',
    transcript: [{ role: 'assistant', message: 'What is your email?' }],
    collected: { email: 'alex@example.com', password: 'Str0ngP@ssw0rd!' },
    credentialTurnIndex: null,
    lastActivity: '2026-08-08T00:00:00.000Z',
    chatSessionId: 'session-1',
};

describe('save strips the password (RESTORE-01, RESTORE-04)', () => {
    it('writes the state to AsyncStorage with the password removed', async () => {
        await save(baseState);

        expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
        const [key, raw] = AsyncStorage.setItem.mock.calls[0];
        const parsed = JSON.parse(raw);

        expect(key).toBe('@stedi/chat-session');
        expect(parsed.collected.password).toBeUndefined();
        expect(parsed.collected.email).toBe('alex@example.com');
        expect(parsed.savedAt).toEqual(expect.any(Number));
    });

    it('never persists a completed session (late save racing the clear)', async () => {
        await save({ ...baseState, currentStep: 'completion' });

        expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('does not throw when AsyncStorage rejects (non-fatal)', async () => {
        AsyncStorage.setItem.mockRejectedValue(new Error('disk full'));

        await expect(save(baseState)).resolves.toBeUndefined();
    });
});

describe('load (RESTORE-02, RESTORE-03)', () => {
    it('returns the parsed state when valid and not expired', async () => {
        const persisted = { ...baseState, collected: { email: 'alex@example.com' }, savedAt: Date.now() };
        AsyncStorage.getItem.mockResolvedValue(JSON.stringify(persisted));

        const result = await load();

        expect(result.currentStep).toBe('email_collection');
        expect(result.collected.email).toBe('alex@example.com');
        expect(result.collected.password).toBeUndefined();
    });

    it('returns null when nothing is stored', async () => {
        AsyncStorage.getItem.mockResolvedValue(null);

        await expect(load()).resolves.toBeNull();
    });

    it('returns null and clears when the data is corrupt JSON', async () => {
        AsyncStorage.getItem.mockResolvedValue('{not json');

        await expect(load()).resolves.toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('returns null and clears when the data is missing currentStep', async () => {
        AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ savedAt: Date.now() }));

        await expect(load()).resolves.toBeNull();
    });

    it('returns null and clears when the session has expired (RESTORE-03)', async () => {
        const expired = { ...baseState, collected: { email: 'alex@example.com' }, savedAt: Date.now() - SESSION_TTL_MS - 1000 };
        AsyncStorage.getItem.mockResolvedValue(JSON.stringify(expired));

        await expect(load()).resolves.toBeNull();
        expect(AsyncStorage.removeItem).toHaveBeenCalled();
    });

    it('respects a custom ttl override (tests)', async () => {
        const recent = { ...baseState, collected: {}, savedAt: Date.now() - 2000 };
        AsyncStorage.getItem.mockResolvedValue(JSON.stringify(recent));

        await expect(load(1000)).resolves.toBeNull();
        await expect(load(5000)).resolves.toEqual(expect.objectContaining({ currentStep: 'email_collection' }));
    });
});

describe('clear (RESTORE-05)', () => {
    it('removes the key', async () => {
        await clear();

        expect(AsyncStorage.removeItem).toHaveBeenCalledWith('@stedi/chat-session');
    });

    it('is idempotent when removeItem rejects', async () => {
        AsyncStorage.removeItem.mockRejectedValue(new Error('gone'));

        await expect(clear()).resolves.toBeUndefined();
    });
});

describe('isExpired (RESTORE-03)', () => {
    it('returns false within the TTL', () => {
        expect(isExpired(Date.now())).toBe(false);
        expect(isExpired(Date.now() - SESSION_TTL_MS + 1000)).toBe(false);
    });

    it('returns true after the TTL', () => {
        expect(isExpired(Date.now() - SESSION_TTL_MS - 1)).toBe(true);
    });

    it('returns true for a non-numeric savedAt', () => {
        expect(isExpired(NaN)).toBe(true);
        expect(isExpired(undefined)).toBe(true);
        expect(isExpired('yesterday')).toBe(true);
    });
});
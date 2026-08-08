// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearSession, loadSession, saveSession } from '@/lib/use-session-restore';

const STORAGE_KEY = 'stedi-chat-session';

beforeEach(() => {
    sessionStorage.clear();
});

afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
});

const baseState = {
    messages: [{ role: 'assistant' as const, message: 'Hello' }],
    currentStep: 'email_collection' as const,
    collected: { email: 'alex@example.com', password: 'Str0ngP@ssw0rd!' },
    chatSessionId: 'session-1',
};

describe('saveSession strips the password (WEBRESTORE-01, WEBRESTORE-03)', () => {
    it('writes the state to sessionStorage with the password removed', () => {
        saveSession(baseState);

        const raw = sessionStorage.getItem(STORAGE_KEY);
        const parsed = JSON.parse(raw ?? '{}');

        expect(parsed.collected.password).toBeUndefined();
        expect(parsed.collected.email).toBe('alex@example.com');
        expect(parsed.savedAt).toEqual(expect.any(Number));
    });

    it('does not persist a completed session', () => {
        saveSession({ ...baseState, currentStep: 'completion' });

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});

describe('loadSession (WEBRESTORE-02, WEBRESTORE-05)', () => {
    it('returns the parsed state when valid', () => {
        saveSession(baseState);

        const result = loadSession();

        expect(result?.currentStep).toBe('email_collection');
        expect(result?.collected.email).toBe('alex@example.com');
        expect(result?.collected.password).toBeUndefined();
    });

    it('returns null when nothing is stored', () => {
        expect(loadSession()).toBeNull();
    });

    it('returns null and clears when the data is corrupt', () => {
        sessionStorage.setItem(STORAGE_KEY, '{not json');

        expect(loadSession()).toBeNull();
        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns null and clears when the session has expired (30 min)', () => {
        const expired = {
            ...baseState,
            collected: { email: 'alex@example.com' },
            savedAt: Date.now() - 31 * 60 * 1000,
        };
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(expired));

        expect(loadSession()).toBeNull();
        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});

describe('clearSession (WEBRESTORE-04)', () => {
    it('removes the key', () => {
        saveSession(baseState);
        expect(sessionStorage.getItem(STORAGE_KEY)).not.toBeNull();

        clearSession();

        expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });
});

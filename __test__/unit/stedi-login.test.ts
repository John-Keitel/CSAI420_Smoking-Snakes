import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: {
        STEDI_API_BASE_URL: 'https://dev.stedi.me',
        STEDI_PROXY_TIMEOUT_MS: 8000,
    },
}));

const loggerErrorMock = vi.fn();

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({
        error: loggerErrorMock,
    }),
}));

describe('authenticateWithStedi', () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns the trimmed STEDI session token on success', async () => {
        fetchMock.mockResolvedValue(new Response('  session-token  ', { status: 200 }));

        const { authenticateWithStedi } = await import('@/lib/auth/stedi-login');
        const result = await authenticateWithStedi({ username: 'patient@example.com', password: 'secret' });

        expect(result).toEqual({ token: 'session-token' });
        expect(fetchMock).toHaveBeenCalledWith(
            new URL('/login', 'https://dev.stedi.me/'),
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ userName: 'patient@example.com', password: 'secret' }),
            })
        );
    });

    it('rejects invalid input before calling STEDI', async () => {
        const { authenticateWithStedi, StediLoginError } = await import('@/lib/auth/stedi-login');

        await expect(authenticateWithStedi({ username: '', password: '' })).rejects.toMatchObject({
            code: 'INVALID_INPUT',
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('maps credential failures to INVALID_CREDENTIALS', async () => {
        fetchMock.mockResolvedValue(new Response('nope', { status: 401 }));

        const { authenticateWithStedi, StediLoginError } = await import('@/lib/auth/stedi-login');

        await expect(authenticateWithStedi({ username: 'patient@example.com', password: 'bad-pass' })).rejects.toMatchObject({
            code: 'INVALID_CREDENTIALS',
        });
    });

    it('maps timeout failures to UPSTREAM_TIMEOUT', async () => {
        fetchMock.mockRejectedValue(new DOMException('timed out', 'TimeoutError'));

        const { authenticateWithStedi, StediLoginError } = await import('@/lib/auth/stedi-login');

        await expect(authenticateWithStedi({ username: 'patient@example.com', password: 'secret' })).rejects.toMatchObject({
            code: 'UPSTREAM_TIMEOUT',
        });
    });

    it('maps non-auth upstream failures to UPSTREAM_UNAVAILABLE', async () => {
        fetchMock.mockResolvedValue(new Response('broken', { status: 503 }));

        const { authenticateWithStedi, StediLoginError } = await import('@/lib/auth/stedi-login');

        await expect(authenticateWithStedi({ username: 'patient@example.com', password: 'secret' })).rejects.toMatchObject({
            code: 'UPSTREAM_UNAVAILABLE',
        });
        expect(loggerErrorMock).toHaveBeenCalled();
    });
});

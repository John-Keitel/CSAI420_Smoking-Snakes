import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    authenticateWithStediMock,
    createBetterAuthSessionMock,
    prismaMock,
    redirectMock,
    syncCredentialAccountMock,
    upsertStediSessionLinkMock,
} = vi.hoisted(() => ({
    authenticateWithStediMock: vi.fn(),
    createBetterAuthSessionMock: vi.fn(),
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
    },
    redirectMock: vi.fn((location: string) => {
        throw new Error(`REDIRECT:${location}`);
    }),
    syncCredentialAccountMock: vi.fn(),
    upsertStediSessionLinkMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    redirect: redirectMock,
}));

vi.mock('@/lib/auth/stedi-login', () => ({
    StediLoginError: class StediLoginError extends Error {
        constructor(
            public code: string,
            message: string
        ) {
            super(message);
        }
    },
    authenticateWithStedi: authenticateWithStediMock,
}));

vi.mock('@/lib/auth/credential-account', () => ({
    syncCredentialAccount: syncCredentialAccountMock,
}));

vi.mock('@/lib/auth/session-cookie', () => ({
    createBetterAuthSession: createBetterAuthSessionMock,
}));

vi.mock('@/lib/auth/stedi-session-link', () => ({
    upsertStediSessionLink: upsertStediSessionLinkMock,
}));

vi.mock('@/lib/db', () => ({
    prisma: prismaMock,
}));

describe('loginAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns field errors for blank username/password input', async () => {
        const { loginAction } = await import('@/app/login/actions');

        const formData = new FormData();
        formData.set('username', '');
        formData.set('password', '');

        await expect(loginAction({}, formData)).resolves.toEqual({
            fieldErrors: {
                username: ['required'],
                password: ['required'],
            },
        });
        expect(authenticateWithStediMock).not.toHaveBeenCalled();
    });

    it('returns a generic login error when the STEDI-authenticated user is not a local app user', async () => {
        authenticateWithStediMock.mockResolvedValue({ token: 'stedi-token' });
        prismaMock.user.findUnique.mockResolvedValue(null);

        const { loginAction } = await import('@/app/login/actions');

        const formData = new FormData();
        formData.set('username', 'patient@example.com');
        formData.set('password', 'secret');

        await expect(loginAction({}, formData)).resolves.toEqual({
            formError: 'Unable to sign in with this account.',
        });
    });

    it('creates the app session, links the STEDI token, and redirects on success', async () => {
        authenticateWithStediMock.mockResolvedValue({ token: 'stedi-token' });
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-1',
            email: 'patient@example.com',
            password: 'hashed-password',
            firstName: 'Pat',
            lastName: 'Ient',
            emailVerified: null,
        });
        createBetterAuthSessionMock.mockResolvedValue({ session: { id: 'session-1' } });

        const { loginAction } = await import('@/app/login/actions');

        const formData = new FormData();
        formData.set('username', 'patient@example.com');
        formData.set('password', 'secret');

        await expect(loginAction({}, formData)).rejects.toThrow('REDIRECT:/dashboard');
        expect(syncCredentialAccountMock).toHaveBeenCalled();
        expect(upsertStediSessionLinkMock).toHaveBeenCalledWith('session-1', 'stedi-token', 'patient@example.com');
    });
});

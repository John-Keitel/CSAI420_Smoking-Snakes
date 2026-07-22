import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { authGetSessionMock, authSignOutMock, deleteStediSessionLinkMock, headersMock, loggerDebugMock, loggerErrorMock, prismaMock } =
    vi.hoisted(() => ({
        authGetSessionMock: vi.fn(),
        authSignOutMock: vi.fn(),
        deleteStediSessionLinkMock: vi.fn(),
        headersMock: vi.fn(),
        loggerDebugMock: vi.fn(),
        loggerErrorMock: vi.fn(),
        prismaMock: {
            session: {
                findUnique: vi.fn(),
                delete: vi.fn(),
            },
        },
    }));

vi.mock('next/headers', () => ({
    headers: headersMock,
}));

vi.mock('@/lib/auth/better-auth', () => ({
    auth: {
        api: {
            getSession: authGetSessionMock,
            signOut: authSignOutMock,
        },
    },
    getAuthenticatedSession: vi.fn(),
}));

vi.mock('@/lib/auth/stedi-session-link', () => ({
    deleteStediSessionLink: deleteStediSessionLinkMock,
}));

vi.mock('@/lib/db', () => ({
    prisma: prismaMock,
}));

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({
        debug: loggerDebugMock,
        error: loggerErrorMock,
    }),
}));

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: {
        AUTH_SECRET: 'auth-secret-auth-secret-auth-secret',
        NEXTAUTH_URL: 'http://localhost:3000',
    },
}));

describe('auth session compatibility layer', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('resolves the current app session from Better Auth when a cookie-backed session exists', async () => {
        headersMock.mockResolvedValue(new Headers());
        authGetSessionMock.mockResolvedValue({ session: { id: 'session-1' } });
        prismaMock.session.findUnique.mockResolvedValue({
            id: 'session-1',
            updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            user: { id: 'user-1', type: 'developer' },
        });

        const { getSession } = await import('@/lib/auth');
        const session = await getSession();

        expect(authGetSessionMock).toHaveBeenCalledWith({ headers: expect.any(Headers) });
        expect(prismaMock.session.findUnique).toHaveBeenCalledWith({
            where: { id: 'session-1' },
            include: { user: true },
        });
        expect(session).toMatchObject({ id: 'session-1', user: { id: 'user-1' } });
    });

    it('returns 401 when neither a Better Auth session nor a bearer token is present', async () => {
        headersMock.mockResolvedValue(new Headers());
        authGetSessionMock.mockResolvedValue(null);

        const { getSession } = await import('@/lib/auth');

        await expect(getSession()).rejects.toMatchObject({ statusCode: 401, message: 'Unauthenticated' });
    });

    it('signs out a Better Auth session and clears the linked STEDI token', async () => {
        headersMock.mockResolvedValue(new Headers({ cookie: 'better-auth=1' }));
        authGetSessionMock.mockResolvedValue({ session: { id: 'session-1' } });
        authSignOutMock.mockResolvedValue(
            new Response(JSON.stringify({ success: true }), { headers: { 'set-cookie': 'session=; Max-Age=0' } })
        );

        const { DELETE } = await import('@/app/auth/signout/route');
        const response = await DELETE();

        expect(deleteStediSessionLinkMock).toHaveBeenCalledWith('session-1');
        expect(authSignOutMock).toHaveBeenCalledWith({ headers: expect.any(Headers), asResponse: true });
        expect(prismaMock.session.delete).not.toHaveBeenCalled();
        expect(response.status).toBe(204);
        expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    });

    it('falls back to deleting the stored session directly during legacy bearer sign-out', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-21T00:00:00.000Z'));

        const { createJwtToken } = await import('@/lib/auth');
        const { token } = await createJwtToken({
            id: 'session-1',
            userId: 'user-1',
            token: 'session-token',
            expiresAt: new Date('2026-08-20T00:00:00.000Z'),
            ipAddress: null,
            userAgent: null,
            createdAt: new Date('2026-07-21T00:00:00.000Z'),
            updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            user: {
                id: 'user-1',
                firstName: 'Dev',
                lastName: 'User',
                email: 'developer@stedi.com',
                image: null,
                type: 'developer',
            },
        } as never);

        const authorizationHeaders = new Headers({
            authorization: `Bearer ${token}`,
        });

        headersMock.mockResolvedValue(authorizationHeaders);
        authGetSessionMock.mockResolvedValue(null);
        prismaMock.session.findUnique.mockResolvedValue({
            id: 'session-1',
            updatedAt: new Date('2026-07-21T00:00:00.000Z'),
            user: { id: 'user-1', type: 'developer' },
        });

        const { DELETE } = await import('@/app/auth/signout/route');
        const response = await DELETE();

        expect(deleteStediSessionLinkMock).toHaveBeenCalledWith('session-1');
        expect(prismaMock.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
        expect(response.status).toBe(204);
    });
});

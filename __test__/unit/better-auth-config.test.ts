import { beforeEach, describe, expect, it, vi } from 'vitest';

const { betterAuthMock, headersMock, nextCookiesMock, prismaAdapterMock, toNextJsHandlerMock } = vi.hoisted(() => {
    const authInstance = {
        api: {
            getSession: vi.fn(),
        },
    };

    return {
        betterAuthMock: vi.fn(() => authInstance),
        headersMock: vi.fn(async () => new Headers({ cookie: 'session=abc' })),
        nextCookiesMock: vi.fn(() => ({ id: 'next-cookies-plugin' })),
        prismaAdapterMock: vi.fn(() => ({ adapter: 'prisma' })),
        toNextJsHandlerMock: vi.fn(() => ({
            GET: vi.fn(),
            POST: vi.fn(),
        })),
    };
});

vi.mock('better-auth', () => ({
    betterAuth: betterAuthMock,
}));

vi.mock('better-auth/adapters/prisma', () => ({
    prismaAdapter: prismaAdapterMock,
}));

vi.mock('better-auth/next-js', () => ({
    nextCookies: nextCookiesMock,
    toNextJsHandler: toNextJsHandlerMock,
}));

vi.mock('next/headers', () => ({
    headers: headersMock,
}));

vi.mock('@/lib/db', () => ({
    prisma: { client: 'prisma' },
}));

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: {
        BETTER_AUTH_SECRET: 'secret-value',
        BETTER_AUTH_URL: 'http://localhost:3000',
        NEXTAUTH_URL: 'http://localhost:3000',
    },
}));

describe('Better Auth scaffolding', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('configures Better Auth with the Prisma adapter, session settings, and field mapping', async () => {
        await import('@/lib/auth/better-auth');

        expect(prismaAdapterMock).toHaveBeenCalledWith({ client: 'prisma' }, { provider: 'postgresql' });
        expect(nextCookiesMock).toHaveBeenCalledTimes(1);
        expect(betterAuthMock).toHaveBeenCalledWith(
            expect.objectContaining({
                secret: 'secret-value',
                baseURL: 'http://localhost:3000',
                trustedOrigins: ['http://localhost:3000'],
                user: {
                    fields: {
                        name: 'authName',
                        emailVerified: 'authEmailVerified',
                    },
                },
                session: expect.objectContaining({
                    expiresIn: 60 * 60 * 24 * 30,
                    updateAge: 60 * 60 * 24,
                    cookieCache: { enabled: true, maxAge: 60 * 5 },
                }),
                emailAndPassword: expect.objectContaining({
                    enabled: true,
                    disableSignUp: true,
                }),
                plugins: [{ id: 'next-cookies-plugin' }],
            })
        );
    });

    it('wires the Next.js auth catch-all route to the shared auth instance', async () => {
        const routeModule = await import('@/app/api/auth/[...all]/route');

        expect(toNextJsHandlerMock).toHaveBeenCalledTimes(1);
        expect(routeModule.GET).toBeDefined();
        expect(routeModule.POST).toBeDefined();
    });

    it('uses request headers when reading the authenticated session on the server', async () => {
        const authModule = await import('@/lib/auth/better-auth');

        await authModule.getAuthenticatedSession();

        expect(headersMock).toHaveBeenCalledTimes(1);
        expect(authModule.auth.api.getSession).toHaveBeenCalledWith({
            headers: expect.any(Headers),
        });
    });
});

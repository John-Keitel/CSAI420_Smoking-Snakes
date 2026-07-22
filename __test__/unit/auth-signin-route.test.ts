import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authHandlerMock, loggerMock, prismaMock, syncCredentialAccountMock, verifyPasswordMock } = vi.hoisted(() => ({
    authHandlerMock: vi.fn(),
    loggerMock: { debug: vi.fn(), error: vi.fn() },
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
    },
    syncCredentialAccountMock: vi.fn(),
    verifyPasswordMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
    auth: {
        handler: authHandlerMock,
    },
    verifyPassword: verifyPasswordMock,
}));

vi.mock('@/lib/auth/credential-account', () => ({
    syncCredentialAccount: syncCredentialAccountMock,
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/auth/signin/route';

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/auth/signin', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /auth/signin', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns 400 for unknown credentials', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const response = await POST(buildRequest({ email: 'unknown@example.com', password: 'wrong' }));

        expect(response.status).toBe(400);
        await expect(response.json()).resolves.toEqual({ message: 'Invalid email or password' });
        expect(authHandlerMock).not.toHaveBeenCalled();
    });

    it('returns 400 when the password does not match', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-1',
            email: 'developer@stedi.com',
            password: 'hashed-password',
            firstName: 'Dev',
            lastName: 'User',
            emailVerified: null,
        });
        verifyPasswordMock.mockResolvedValue(false);

        const response = await POST(buildRequest({ email: 'developer@stedi.com', password: 'wrong' }));

        expect(response.status).toBe(400);
        expect(syncCredentialAccountMock).not.toHaveBeenCalled();
        expect(authHandlerMock).not.toHaveBeenCalled();
    });

    it('provisions the credential account, delegates session creation to Better Auth, and returns a cookie-backed success response', async () => {
        prismaMock.user.findUnique.mockResolvedValue({
            id: 'user-1',
            email: 'developer@stedi.com',
            password: 'hashed-password',
            firstName: 'Dev',
            lastName: 'User',
            emailVerified: null,
        });
        verifyPasswordMock.mockResolvedValue(true);
        authHandlerMock.mockResolvedValue(
            new Response(JSON.stringify({ token: 'secret-token' }), { status: 200, headers: { 'set-cookie': 'session=abc; Path=/; HttpOnly' } })
        );

        const response = await POST(buildRequest({ email: 'developer@stedi.com', password: '@123Change' }));

        expect(syncCredentialAccountMock).toHaveBeenCalledWith({
            id: 'user-1',
            email: 'developer@stedi.com',
            password: 'hashed-password',
            firstName: 'Dev',
            lastName: 'User',
            emailVerified: null,
        });
        expect(authHandlerMock).toHaveBeenCalledOnce();
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({ userId: 'user-1' });
        expect(response.headers.get('set-cookie')).toContain('session=abc');
    });
});

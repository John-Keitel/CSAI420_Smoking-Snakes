import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authGetSessionMock, getStediTokenForSessionMock, prismaUserFindUniqueMock } = vi.hoisted(() => ({
    authGetSessionMock: vi.fn(),
    getStediTokenForSessionMock: vi.fn(),
    prismaUserFindUniqueMock: vi.fn(),
}));

vi.mock('@/lib/auth/better-auth', () => ({
    auth: {
        api: {
            getSession: authGetSessionMock,
        },
    },
}));

vi.mock('@/lib/auth/stedi-session-link', () => ({
    getStediTokenForSession: getStediTokenForSessionMock,
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        user: {
            findUnique: prismaUserFindUniqueMock,
        },
    },
}));

describe('SureSteps session resolution', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('uses the explicit suresteps.session.token header when present', async () => {
        const { resolveSureStepsSession } = await import('@/lib/auth/suresteps');

        const result = await resolveSureStepsSession(
            new NextRequest('http://localhost/api/test', {
                headers: {
                    'suresteps.session.token': 'legacy-token',
                    'suresteps.user.email': 'patient@example.com',
                },
            })
        );

        expect(result).toMatchObject({
            ok: true,
            token: 'legacy-token',
            source: 'header',
        });
        expect(authGetSessionMock).not.toHaveBeenCalled();
    });

    it('resolves the STEDI token from the authenticated app session when no header is present', async () => {
        authGetSessionMock.mockResolvedValue({
            session: { id: 'session-1' },
            user: { id: 'user-1' },
        });
        getStediTokenForSessionMock.mockResolvedValue('server-token');
        prismaUserFindUniqueMock.mockResolvedValue({
            id: 'user-1',
            email: 'patient@example.com',
            type: 'standard',
        });

        const { resolveSureStepsSession } = await import('@/lib/auth/suresteps');
        const result = await resolveSureStepsSession(new NextRequest('http://localhost/api/test'));

        expect(getStediTokenForSessionMock).toHaveBeenCalledWith('session-1');
        expect(prismaUserFindUniqueMock).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            select: { id: true, email: true, type: true },
        });
        expect(result).toMatchObject({
            ok: true,
            token: 'server-token',
            source: 'auth-session',
            user: { id: 'user-1', email: 'patient@example.com', type: 'standard' },
        });
    });

    it('fails when an authenticated session has no linked STEDI token', async () => {
        authGetSessionMock.mockResolvedValue({
            session: { id: 'session-1' },
            user: { id: 'user-1' },
        });
        getStediTokenForSessionMock.mockResolvedValue(null);

        const { resolveSureStepsSession } = await import('@/lib/auth/suresteps');
        const result = await resolveSureStepsSession(new NextRequest('http://localhost/api/test'));

        expect(result).toEqual({
            ok: false,
            reason: 'STEDI session token missing for authenticated session',
        });
    });
});

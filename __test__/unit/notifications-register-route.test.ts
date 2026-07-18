import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock, prismaMock, validateSessionMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    prismaMock: {
        user: {
            findUnique: vi.fn(),
        },
        expoPushToken: {
            upsert: vi.fn(),
        },
    },
    validateSessionMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
vi.mock('@/lib/auth/suresteps', () => ({ validateSureStepsSession: validateSessionMock }));

import { POST } from '@/app/api/notifications/register/route';

const headers = { 'suresteps.session.token': 'legacy-session-token' };
const userId = 'a'.repeat(25);
const validToken = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/api/notifications/register', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

describe('POST /api/notifications/register', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        validateSessionMock.mockReturnValue({ ok: true });
    });

    it('returns 401 when the session token is invalid', async () => {
        validateSessionMock.mockReturnValue({ ok: false, reason: 'Missing suresteps.session.token header' });

        const response = await POST(buildRequest({ token: validToken, userId }));

        expect(response.status).toBe(401);
        expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
        expect(prismaMock.expoPushToken.upsert).not.toHaveBeenCalled();
    });

    it('returns 422 when the body fails validation', async () => {
        const response = await POST(buildRequest({ token: 'not-an-expo-token', userId }));

        expect(response.status).toBe(422);
        await expect(response.json()).resolves.toMatchObject({
            message: 'validation error',
            errors: { token: expect.any(Array) },
        });
        expect(prismaMock.expoPushToken.upsert).not.toHaveBeenCalled();
    });

    it('returns 404 when the user does not exist', async () => {
        prismaMock.user.findUnique.mockResolvedValue(null);

        const response = await POST(buildRequest({ token: validToken, userId }));

        expect(response.status).toBe(404);
        expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: userId } });
        expect(prismaMock.expoPushToken.upsert).not.toHaveBeenCalled();
    });

    it('creates a new token and returns 201 with the token payload', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: userId });
        prismaMock.expoPushToken.upsert.mockResolvedValue({
            id: 'token-1',
            token: validToken,
            userId,
            deviceName: 'iPhone 15',
            platform: 'ios',
            isActive: true,
        });

        const response = await POST(buildRequest({ token: validToken, userId, deviceName: 'iPhone 15', platform: 'ios' }));

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            id: 'token-1',
            token: validToken,
            userId,
            platform: 'ios',
            isActive: true,
        });
        expect(prismaMock.expoPushToken.upsert).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { token: validToken },
                create: expect.objectContaining({
                    token: validToken,
                    userId,
                    deviceName: 'iPhone 15',
                    platform: 'ios',
                    isActive: true,
                }),
                update: expect.objectContaining({
                    userId,
                    deviceName: 'iPhone 15',
                    platform: 'ios',
                    isActive: true,
                }),
            })
        );
    });

    it('upserts (refreshes) an already-registered token', async () => {
        prismaMock.user.findUnique.mockResolvedValue({ id: userId });
        prismaMock.expoPushToken.upsert.mockResolvedValue({
            id: 'token-1',
            token: validToken,
            userId,
            platform: 'android',
            isActive: true,
        });

        const response = await POST(buildRequest({ token: validToken, userId, platform: 'android' }));

        expect(response.status).toBe(201);
        expect(prismaMock.expoPushToken.upsert).toHaveBeenCalledTimes(1);

        const upsertArg = prismaMock.expoPushToken.upsert.mock.calls[0][0];
        expect(upsertArg.where).toEqual({ token: validToken });
        expect(upsertArg.update).toMatchObject({ userId, isActive: true });
        expect(upsertArg.update.lastUsedAt).toBeInstanceOf(Date);
    });
});

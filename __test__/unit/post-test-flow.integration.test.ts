import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Only the EXTERNAL boundaries are mocked here: the STEDI proxy (route -> STEDI),
// the risk-score fetch, the Expo SDK, the database, and config/logging. The glue
// under test — @/lib/events, @/lib/notifications/post-test-push and
// @/lib/notifications/expo-client — is the REAL code, so the whole post-test push
// chain runs in memory exactly as it would in production.
const { proxyToStediMock, prismaMock, loggerMock, chunkMock, sendMock, isTokenMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
    prismaMock: {
        expoPushToken: {
            findMany: vi.fn(),
            updateMany: vi.fn(),
        },
    },
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    chunkMock: vi.fn(),
    sendMock: vi.fn(),
    isTokenMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({ proxyToStedi: proxyToStediMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/env-vars', () => ({ ENV_VARS: { STEDI_API_BASE_URL: 'https://dev.stedi.me' } }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
vi.mock('expo-server-sdk', () => {
    class Expo {
        chunkPushNotifications = chunkMock;
        sendPushNotificationsAsync = sendMock;
        static isExpoPushToken = isTokenMock;
    }
    return { Expo, default: Expo };
});

// Real chain — intentionally NOT mocked below this line.
import { POST } from '@/app/rapidsteptest/route';

const email = 'test_user@example.com';
const sessionToken = 'legacy-session-token';
const pushToken = 'ExponentPushToken[integration-abc]';

function buildRequest(body: Record<string, unknown> = { customer: email }, withToken = true) {
    return new NextRequest('http://localhost/rapidsteptest', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...(withToken ? { 'suresteps.session.token': sessionToken } : {}),
        },
        body: JSON.stringify(body),
    });
}

function stubScore(score: number) {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ score }) });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
}

describe('post-test push flow (full chain, in-memory)', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        proxyToStediMock.mockResolvedValue(new NextResponse('Saved', { status: 200 }));
        prismaMock.expoPushToken.findMany.mockResolvedValue([{ token: pushToken, isActive: true }]);
        prismaMock.expoPushToken.updateMany.mockResolvedValue({ count: 1 });
        isTokenMock.mockReturnValue(true);
        chunkMock.mockImplementation((messages: unknown[]) => [messages]);
        sendMock.mockResolvedValue([{ status: 'ok', id: 'receipt-1' }]);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('drives score lookup, token lookup and SDK send from a successful /rapidsteptest', async () => {
        const fetchMock = stubScore(88);

        const response = await POST(buildRequest());
        expect(response.status).toBe(200);

        // The event fired and the REAL handler ran the whole chain (verified via
        // its downstream effects rather than a mock spy).
        await vi.waitFor(() => expect(sendMock).toHaveBeenCalledTimes(1));

        // a) score lookup hit STEDI's riskscore endpoint with the session header
        const [scoreUrl, scoreInit] = fetchMock.mock.calls[0];
        expect(String(scoreUrl)).toBe(`https://dev.stedi.me/riskscore/${encodeURIComponent(email)}`);
        expect(scoreInit.headers).toMatchObject({ 'suresteps.session.token': sessionToken });

        // b) active-token lookup for the customer
        expect(prismaMock.expoPushToken.findMany).toHaveBeenCalledWith({
            where: { user: { email }, isActive: true },
        });

        // c) the correct message reached the Expo SDK
        const sentChunk = sendMock.mock.calls[0][0];
        expect(sentChunk).toEqual([
            expect.objectContaining({
                to: pushToken,
                title: 'Your balance score is ready',
                body: expect.stringContaining('88'),
                data: expect.objectContaining({ score: 88, type: 'post-test-score' }),
            }),
        ]);
    });

    it('deactivates the token when the SDK ticket reports DeviceNotRegistered', async () => {
        stubScore(50);
        sendMock.mockResolvedValue([{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered', expoPushToken: pushToken } }]);

        const response = await POST(buildRequest());
        expect(response.status).toBe(200);

        await vi.waitFor(() =>
            expect(prismaMock.expoPushToken.updateMany).toHaveBeenCalledWith({
                where: { token: pushToken },
                data: { isActive: false },
            })
        );
    });

    it('does not reach the SDK when the customer has no active tokens', async () => {
        stubScore(20);
        prismaMock.expoPushToken.findMany.mockResolvedValue([]);

        const response = await POST(buildRequest());
        expect(response.status).toBe(200);

        await vi.waitFor(() => expect(prismaMock.expoPushToken.findMany).toHaveBeenCalled());
        expect(sendMock).not.toHaveBeenCalled();
    });

    it('keeps the endpoint response intact when the score fetch fails', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new Error('STEDI down'));
        vi.stubGlobal('fetch', fetchMock);

        const response = await POST(buildRequest());

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Saved');
        // The chain attempted the fetch, swallowed the error, and never reached the SDK.
        await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
        expect(sendMock).not.toHaveBeenCalled();
    });

    it('keeps the endpoint response intact when the Expo SDK send fails', async () => {
        stubScore(70);
        sendMock.mockRejectedValue(new Error('expo network error'));

        const response = await POST(buildRequest());

        expect(response.status).toBe(200);
        await expect(response.text()).resolves.toBe('Saved');
        await vi.waitFor(() => expect(sendMock).toHaveBeenCalled());
    });
});

import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyToStediMock, emitMock, loggerMock, prismaMock, sendPushMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
    emitMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    prismaMock: {
        expoPushToken: {
            findMany: vi.fn(),
        },
    },
    sendPushMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({ proxyToStedi: proxyToStediMock }));
vi.mock('@/lib/events', () => ({ emitPostTestCompleted: emitMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/env-vars', () => ({ ENV_VARS: { STEDI_API_BASE_URL: 'https://dev.stedi.me' } }));
vi.mock('@/lib/notifications/expo-client', () => ({ sendPushNotifications: sendPushMock }));

import { POST } from '@/app/rapidsteptest/route';
import { handlePostTestCompleted } from '@/lib/notifications/post-test-push';

const email = 'test_user@example.com';
const sessionToken = 'legacy-session-token';

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

describe('post-test push trigger', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        proxyToStediMock.mockResolvedValue(new NextResponse('Saved', { status: 200 }));
        sendPushMock.mockResolvedValue({ sent: 1, failed: 0, deactivated: 0 });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('POST /rapidsteptest', () => {
        it('emits a post-test-completed event on a 2xx response', async () => {
            const request = buildRequest();

            const response = await POST(request);

            expect(response.status).toBe(200);
            // Pass-through is unchanged: the original request is proxied verbatim.
            expect(proxyToStediMock).toHaveBeenCalledWith(request, '/rapidsteptest', { forwardSessionToken: true });
            await vi.waitFor(() => expect(emitMock).toHaveBeenCalledTimes(1));
            expect(emitMock).toHaveBeenCalledWith({ customerEmail: email, sessionToken });
        });

        it('does not emit an event on a 4xx/5xx response', async () => {
            proxyToStediMock.mockResolvedValue(new NextResponse('Bad Request', { status: 400 }));

            const response = await POST(buildRequest());

            expect(response.status).toBe(400);
            // Give any (incorrect) fire-and-forget a chance to run before asserting.
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(emitMock).not.toHaveBeenCalled();
        });

        it('returns the proxy response unchanged even if the emitter throws', async () => {
            emitMock.mockImplementation(() => {
                throw new Error('emit boom');
            });

            const response = await POST(buildRequest());

            expect(response.status).toBe(200);
            await expect(response.text()).resolves.toBe('Saved');
            // The thrown error is swallowed by the fire-and-forget guard; POST never rejects.
            await vi.waitFor(() => expect(emitMock).toHaveBeenCalled());
        });

        it('does not emit when the session token header is missing', async () => {
            const response = await POST(buildRequest({ customer: email }, false));

            expect(response.status).toBe(200);
            await new Promise((resolve) => setTimeout(resolve, 20));
            expect(emitMock).not.toHaveBeenCalled();
        });
    });

    describe('handlePostTestCompleted', () => {
        it('fetches the risk score and looks up the active push tokens', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ score: 42 }),
            });
            vi.stubGlobal('fetch', fetchMock);
            prismaMock.expoPushToken.findMany.mockResolvedValue([{ token: 'ExponentPushToken[abc]', isActive: true }]);

            await handlePostTestCompleted({ customerEmail: email, sessionToken });

            expect(fetchMock).toHaveBeenCalledTimes(1);
            const [calledUrl, calledInit] = fetchMock.mock.calls[0];
            expect(String(calledUrl)).toBe(`https://dev.stedi.me/riskscore/${encodeURIComponent(email)}`);
            expect(calledInit.headers).toMatchObject({ 'suresteps.session.token': sessionToken });
            expect(prismaMock.expoPushToken.findMany).toHaveBeenCalledWith({
                where: { user: { email }, isActive: true },
            });
        });

        it('sends a push notification with the score to each active token', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ score: 42 }),
            });
            vi.stubGlobal('fetch', fetchMock);
            prismaMock.expoPushToken.findMany.mockResolvedValue([{ token: 'ExponentPushToken[abc]', isActive: true }]);

            await handlePostTestCompleted({ customerEmail: email, sessionToken });

            expect(sendPushMock).toHaveBeenCalledTimes(1);
            expect(sendPushMock).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: 'ExponentPushToken[abc]',
                    title: 'Your balance score is ready',
                    body: expect.stringContaining('42'),
                    data: expect.objectContaining({ score: 42, type: 'post-test-score' }),
                }),
            ]);
        });

        it('does not send a push and resolves without throwing when there are no active tokens', async () => {
            const fetchMock = vi.fn().mockResolvedValue({
                ok: true,
                json: async () => ({ score: 10 }),
            });
            vi.stubGlobal('fetch', fetchMock);
            prismaMock.expoPushToken.findMany.mockResolvedValue([]);

            await expect(handlePostTestCompleted({ customerEmail: email, sessionToken })).resolves.toBeUndefined();
            expect(prismaMock.expoPushToken.findMany).toHaveBeenCalledWith({
                where: { user: { email }, isActive: true },
            });
            expect(sendPushMock).not.toHaveBeenCalled();
        });
    });
});

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proxyToStedi } from '@/lib/stedi-api';

const { resolveSureStepsSessionMock } = vi.hoisted(() => ({
    resolveSureStepsSessionMock: vi.fn(),
}));

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: {
        STEDI_API_BASE_URL: 'https://dev.stedi.me',
        STEDI_PROXY_TIMEOUT_MS: 8000,
    },
}));

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({
        error: vi.fn(),
    }),
}));

vi.mock('@/lib/auth/suresteps', () => ({
    resolveSureStepsSession: resolveSureStepsSessionMock,
}));

describe('proxyToStedi', () => {
    const fetchMock = vi.fn<typeof fetch>();
    const createRequest = () => new NextRequest('http://localhost/user', { method: 'POST', body: '{}' });

    beforeEach(() => {
        fetchMock.mockResolvedValue(new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }));
        vi.stubGlobal('fetch', fetchMock);
        resolveSureStepsSessionMock.mockResolvedValue({ ok: false, reason: 'Missing suresteps.session.token header' });
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('proxies an application-controlled relative path to the configured STEDI origin', async () => {
        const response = await proxyToStedi(createRequest(), '/user');

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledOnce();
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://dev.stedi.me/user');

        const fetchInit = fetchMock.mock.calls[0][1];
        expect(fetchInit?.signal).toBeInstanceOf(AbortSignal);
    });

    it('forwards the resolved server-side STEDI token when requested', async () => {
        resolveSureStepsSessionMock.mockResolvedValue({ ok: true, token: 'server-token', user: { id: 'user-1' } });

        await proxyToStedi(createRequest(), '/user', { forwardSessionToken: true });

        const fetchInit = fetchMock.mock.calls[0][1];
        expect((fetchInit?.headers as Headers).get('suresteps.session.token')).toBe('server-token');
    });

    it('returns 504 when the upstream fetch times out', async () => {
        const timeoutError = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
        fetchMock.mockRejectedValueOnce(timeoutError);

        const response = await proxyToStedi(createRequest(), '/devices/updates/recent?seconds=30');

        expect(response.status).toBe(504);
        await expect(response.json()).resolves.toEqual({ error: 'Upstream request timed out' });
    });

    it('returns 504 when the upstream fetch is aborted', async () => {
        const abortError = new DOMException('The operation was aborted', 'AbortError');
        fetchMock.mockRejectedValueOnce(abortError);

        const response = await proxyToStedi(createRequest(), '/user');

        expect(response.status).toBe(504);
        await expect(response.json()).resolves.toEqual({ error: 'Upstream request timed out' });
    });

    it.each(['https://attacker.example/collect', '//attacker.example/collect', '/\\attacker.example/collect'])(
        'rejects a path that can escape the configured STEDI origin: %s',
        async (path) => {
            const response = await proxyToStedi(createRequest(), path);

            expect(response.status).toBe(502);
            expect(fetchMock).not.toHaveBeenCalled();
        }
    );
});

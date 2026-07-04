import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proxyToStedi } from '@/lib/stedi-api';

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: {
        STEDI_API_BASE_URL: 'https://dev.stedi.me',
    },
}));

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({
        error: vi.fn(),
    }),
}));

describe('proxyToStedi', () => {
    const fetchMock = vi.fn<typeof fetch>();
    const createRequest = () => new NextRequest('http://localhost/user', { method: 'POST', body: '{}' });

    beforeEach(() => {
        fetchMock.mockResolvedValue(new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } }));
        vi.stubGlobal('fetch', fetchMock);
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

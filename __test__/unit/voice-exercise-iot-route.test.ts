import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

import { POST } from '@/app/api/voice/exercise/iot/route';

describe('POST /api/voice/exercise/iot', () => {
    const fetchMock = vi.fn<typeof fetch>();

    beforeEach(() => {
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it('triggers sensor activation via REST for bluetooth or wifi transport', async () => {
        fetchMock.mockResolvedValueOnce(new Response('Saved', { status: 200 }));

        const request = new NextRequest('http://localhost/api/voice/exercise/iot', {
            method: 'POST',
            body: JSON.stringify({
                action: 'activate',
                transport: 'bluetooth',
                sessionToken: 'session-token',
                deviceId: 'device-123',
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.message).toMatch(/activation triggered/i);
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://dev.stedi.me/sensorUpdates');
    });

    it('validates backend receives recent IoT updates over REST', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updates: [{ id: 'u1' }] }), { status: 200 }));

        const request = new NextRequest('http://localhost/api/voice/exercise/iot', {
            method: 'POST',
            body: JSON.stringify({
                action: 'validate',
                transport: 'wifi',
                sessionToken: 'session-token',
                seconds: 45,
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.received).toBe(true);
        expect(String(fetchMock.mock.calls[0][0])).toBe('https://dev.stedi.me/devices/updates/recent?seconds=45');
    });

    it('returns non-success when validation finds no recent sensor updates', async () => {
        fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ updates: [] }), { status: 200 }));

        const request = new NextRequest('http://localhost/api/voice/exercise/iot', {
            method: 'POST',
            body: JSON.stringify({
                action: 'validate',
                transport: 'wifi',
                sessionToken: 'session-token',
            }),
        });

        const response = await POST(request);
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.ok).toBe(false);
        expect(body.received).toBe(false);
    });
});
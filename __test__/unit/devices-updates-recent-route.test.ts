import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyToStediMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({
    proxyToStedi: proxyToStediMock,
}));

import { GET } from '@/app/devices/updates/recent/route';

describe('GET /devices/updates/recent', () => {
    beforeEach(() => {
        proxyToStediMock.mockResolvedValue(new NextResponse(null, { status: 200 }));
    });

    it('forwards query string to Stedi with forwardSessionToken enabled', async () => {
        const request = new NextRequest('http://localhost/devices/updates/recent?seconds=30');

        await GET(request);

        expect(proxyToStediMock).toHaveBeenCalledWith(request, '/devices/updates/recent?seconds=30', {
            forwardSessionToken: true,
        });
    });

    it('proxies without query string when none is provided', async () => {
        const request = new NextRequest('http://localhost/devices/updates/recent');

        await GET(request);

        expect(proxyToStediMock).toHaveBeenCalledWith(request, '/devices/updates/recent', {
            forwardSessionToken: true,
        });
    });
});

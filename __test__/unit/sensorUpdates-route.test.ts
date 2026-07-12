import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyToStediMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({
    proxyToStedi: proxyToStediMock,
}));

import { POST } from '@/app/sensorUpdates/route';

describe('POST /sensorUpdates', () => {
    beforeEach(() => {
        proxyToStediMock.mockResolvedValue(new NextResponse(null, { status: 200 }));
    });

    it('proxies to Stedi with forwardSessionToken enabled', async () => {
        const request = new NextRequest('http://localhost/sensorUpdates', { method: 'POST' });

        await POST(request);

        expect(proxyToStediMock).toHaveBeenCalledWith(request, '/sensorUpdates', {
            forwardSessionToken: true,
        });
    });
});

import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyToStediMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({
    proxyToStedi: proxyToStediMock,
}));

import { POST } from '@/app/rapidsteptest/route';

describe('POST /rapidsteptest', () => {
    beforeEach(() => {
        proxyToStediMock.mockResolvedValue(new NextResponse(null, { status: 200 }));
    });

    it('proxies to Stedi with forwardSessionToken enabled', async () => {
        const request = new NextRequest('http://localhost/rapidsteptest', { method: 'POST' });

        await POST(request);

        expect(proxyToStediMock).toHaveBeenCalledWith(request, '/rapidsteptest', {
            forwardSessionToken: true,
        });
    });
});

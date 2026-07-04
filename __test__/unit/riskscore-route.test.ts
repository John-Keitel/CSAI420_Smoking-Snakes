import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyToStediMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({
    proxyToStedi: proxyToStediMock,
}));

import { GET } from '@/app/riskscore/[email]/route';

describe('GET /riskscore/[email]', () => {
    beforeEach(() => {
        proxyToStediMock.mockResolvedValue(new NextResponse(null, { status: 200 }));
    });

    it('URL-encodes the email path segment before proxying upstream', async () => {
        const request = new NextRequest('http://localhost/riskscore/test%2Btag%2Fsegment%231%40example.com');

        await GET(request, {
            params: Promise.resolve({
                email: 'test+tag/segment#1@example.com',
            }),
        });

        expect(proxyToStediMock).toHaveBeenCalledWith(request, '/riskscore/test%2Btag%2Fsegment%231%40example.com', {
            forwardSessionToken: true,
        });
    });
});

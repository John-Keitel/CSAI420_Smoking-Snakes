import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { proxyToStediMock } = vi.hoisted(() => ({
    proxyToStediMock: vi.fn(),
}));

vi.mock('@/lib/stedi-api', () => ({
    proxyToStedi: proxyToStediMock,
}));

// The route now emits a post-test-completed event and uses the app logger.
// Mock both so the module graph does not pull in the real env-vars validator.
vi.mock('@/lib/events', () => ({ emitPostTestCompleted: vi.fn() }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => ({ error: vi.fn() }) }));

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

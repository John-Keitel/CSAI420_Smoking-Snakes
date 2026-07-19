import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireModeratorMock, resolveFlaggedSessionMock, loggerMock } = vi.hoisted(() => ({
    requireModeratorMock: vi.fn(),
    resolveFlaggedSessionMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/moderation', () => ({
    requireModerator: requireModeratorMock,
    resolveFlaggedSession: resolveFlaggedSessionMock,
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { PATCH } from '@/app/api/moderation/resolve/[sessionId]/route';
import { HttpException } from '@/lib/http';

const sessionId = '11111111-1111-4111-8111-111111111111';

function buildRequest(body: unknown = {}): NextRequest {
    return new NextRequest(`http://localhost/api/moderation/resolve/${sessionId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('PATCH /api/moderation/resolve/[sessionId]', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        requireModeratorMock.mockResolvedValue({ user: { id: 'mod-1', type: 'developer' } });
    });

    it('resolves an open flagged session', async () => {
        const resolved = {
            sessionId,
            status: 'RESOLVED',
            resolvedByUserId: 'mod-1',
        };
        resolveFlaggedSessionMock.mockResolvedValue(resolved);

        const response = await PATCH(buildRequest({ resolutionNotes: 'Closed after call' }), {
            params: Promise.resolve({ sessionId }),
        });

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(resolved);
        expect(resolveFlaggedSessionMock).toHaveBeenCalledWith({
            sessionId,
            resolvedByUserId: 'mod-1',
            resolutionNotes: 'Closed after call',
        });
    });

    it('returns 404 when flagged session is missing', async () => {
        resolveFlaggedSessionMock.mockRejectedValue(new HttpException(404, 'Flagged session not found'));

        const response = await PATCH(buildRequest(), {
            params: Promise.resolve({ sessionId }),
        });

        expect(response.status).toBe(404);
    });

    it('returns 409 when already resolved', async () => {
        resolveFlaggedSessionMock.mockRejectedValue(
            new HttpException(409, 'Flagged session already resolved')
        );

        const response = await PATCH(buildRequest(), {
            params: Promise.resolve({ sessionId }),
        });

        expect(response.status).toBe(409);
    });
});

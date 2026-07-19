import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireModeratorMock, reviewFlaggedSessionMock, loggerMock } = vi.hoisted(() => ({
    requireModeratorMock: vi.fn(),
    reviewFlaggedSessionMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/moderation', () => ({
    requireModerator: requireModeratorMock,
    reviewFlaggedSession: reviewFlaggedSessionMock,
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/api/moderation/review/route';
import { HttpException } from '@/lib/http';

const sessionId = '11111111-1111-4111-8111-111111111111';

function buildRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/moderation/review', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/moderation/review', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        requireModeratorMock.mockResolvedValue({ user: { id: 'mod-1', type: 'provider' } });
    });

    it('records human override and moves status to IN_REVIEW', async () => {
        const reviewed = {
            sessionId,
            status: 'IN_REVIEW',
            humanOverride: 'Clinician follow-up',
            reviewedByUserId: 'mod-1',
        };
        reviewFlaggedSessionMock.mockResolvedValue(reviewed);

        const response = await POST(
            buildRequest({
                sessionId,
                humanOverride: 'Clinician follow-up',
                reviewerNotes: 'Call patient',
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(reviewed);
        expect(reviewFlaggedSessionMock).toHaveBeenCalledWith({
            sessionId,
            humanOverride: 'Clinician follow-up',
            reviewerNotes: 'Call patient',
            reviewedByUserId: 'mod-1',
        });
    });

    it('returns 404 when flagged session is missing', async () => {
        reviewFlaggedSessionMock.mockRejectedValue(new HttpException(404, 'Flagged session not found'));

        const response = await POST(
            buildRequest({
                sessionId,
                humanOverride: 'Override',
            })
        );

        expect(response.status).toBe(404);
    });

    it('returns 409 when already resolved', async () => {
        reviewFlaggedSessionMock.mockRejectedValue(
            new HttpException(409, 'Flagged session already resolved')
        );

        const response = await POST(
            buildRequest({
                sessionId,
                humanOverride: 'Override',
            })
        );

        expect(response.status).toBe(409);
    });

    it('returns 400 for invalid body', async () => {
        const response = await POST(buildRequest({ humanOverride: 'missing session' }));

        expect(response.status).toBe(400);
        expect(reviewFlaggedSessionMock).not.toHaveBeenCalled();
    });
});

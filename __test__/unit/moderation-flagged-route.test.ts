import { beforeEach, describe, expect, it, vi } from 'vitest';

const { requireModeratorMock, listOpenFlaggedSessionsMock, loggerMock } = vi.hoisted(() => ({
    requireModeratorMock: vi.fn(),
    listOpenFlaggedSessionsMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/moderation', () => ({
    requireModerator: requireModeratorMock,
    listOpenFlaggedSessions: listOpenFlaggedSessionsMock,
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { GET } from '@/app/api/moderation/flagged/route';
import { HttpException } from '@/lib/http';

describe('GET /api/moderation/flagged', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns open flagged sessions for moderators', async () => {
        requireModeratorMock.mockResolvedValue({ user: { id: 'mod-1', type: 'provider' } });
        const rows = [
            {
                id: 'flag-high',
                sessionId: 's1',
                severity: 'HIGH',
                status: 'PENDING',
                flaggedAt: new Date('2026-07-18T12:00:00Z'),
            },
        ];
        listOpenFlaggedSessionsMock.mockResolvedValue(rows);

        const response = await GET();
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toEqual(
            rows.map((row) => ({
                ...row,
                flaggedAt: row.flaggedAt.toISOString(),
            }))
        );
    });

    it('returns 401 when unauthenticated', async () => {
        requireModeratorMock.mockRejectedValue(new HttpException(401, 'Unauthenticated'));

        const response = await GET();

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthenticated' });
    });

    it('returns 403 when caller is standard', async () => {
        requireModeratorMock.mockRejectedValue(new HttpException(403, 'Forbidden'));

        const response = await GET();

        expect(response.status).toBe(403);
        await expect(response.json()).resolves.toEqual({ error: 'Forbidden' });
    });
});

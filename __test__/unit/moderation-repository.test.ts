import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, loggerMock } = vi.hoisted(() => ({
    prismaMock: {
        flaggedSession: {
            findUnique: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            findMany: vi.fn(),
        },
    },
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { listOpenFlaggedSessions, upsertFlaggedSessionOnEscalate } from '@/lib/moderation/repository';

const sessionId = '11111111-1111-1111-1111-111111111111';
const customerEmail = 'patient@example.com';

describe('upsertFlaggedSessionOnEscalate', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns null when escalate is false', async () => {
        const result = await upsertFlaggedSessionOnEscalate({
            sessionId,
            customerEmail,
            escalate: false,
        });

        expect(result).toBeNull();
        expect(prismaMock.flaggedSession.findUnique).not.toHaveBeenCalled();
    });

    it('creates a HIGH PENDING row when none exists', async () => {
        prismaMock.flaggedSession.findUnique.mockResolvedValue(null);
        prismaMock.flaggedSession.create.mockResolvedValue({
            id: 'flag-1',
            sessionId,
            customerEmail,
            severity: 'HIGH',
            status: 'PENDING',
        });

        const result = await upsertFlaggedSessionOnEscalate({
            sessionId,
            customerEmail,
            escalate: true,
            aiRecommendation: 'Escalate for review',
        });

        expect(prismaMock.flaggedSession.create).toHaveBeenCalledWith({
            data: {
                sessionId,
                customerEmail,
                severity: 'HIGH',
                status: 'PENDING',
                aiRecommendation: 'Escalate for review',
            },
        });
        expect(result?.status).toBe('PENDING');
    });

    it('reopens a RESOLVED row as PENDING', async () => {
        prismaMock.flaggedSession.findUnique.mockResolvedValue({
            id: 'flag-1',
            sessionId,
            status: 'RESOLVED',
            aiRecommendation: 'old',
        });
        prismaMock.flaggedSession.update.mockResolvedValue({
            id: 'flag-1',
            sessionId,
            status: 'PENDING',
            severity: 'HIGH',
        });

        await upsertFlaggedSessionOnEscalate({
            sessionId,
            customerEmail,
            escalate: true,
        });

        expect(prismaMock.flaggedSession.update).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { sessionId },
                data: expect.objectContaining({
                    status: 'PENDING',
                    humanOverride: null,
                    resolvedAt: null,
                    alertedAt: null,
                }),
            })
        );
    });
});

describe('listOpenFlaggedSessions', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('queries PENDING and IN_REVIEW sorted by severity then flaggedAt', async () => {
        prismaMock.flaggedSession.findMany.mockResolvedValue([]);

        await listOpenFlaggedSessions();

        expect(prismaMock.flaggedSession.findMany).toHaveBeenCalledWith({
            where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
            orderBy: [{ severity: 'desc' }, { flaggedAt: 'desc' }],
        });
    });
});

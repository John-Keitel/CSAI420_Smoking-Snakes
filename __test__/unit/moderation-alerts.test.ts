import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, sendPushMock, markAlertedMock, loggerMock } = vi.hoisted(() => ({
    prismaMock: {
        expoPushToken: {
            findMany: vi.fn(),
        },
    },
    sendPushMock: vi.fn(),
    markAlertedMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/notifications/expo-client', () => ({ sendPushNotifications: sendPushMock }));
vi.mock('@/lib/moderation/repository', () => ({ markFlaggedSessionAlerted: markAlertedMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { notifyModeratorsHighRisk } from '@/lib/moderation/alerts';

const sessionId = '11111111-1111-4111-8111-111111111111';

describe('notifyModeratorsHighRisk', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        sendPushMock.mockResolvedValue({ sent: 1, failed: 0, deactivated: 0 });
        markAlertedMock.mockResolvedValue({ sessionId, alertedAt: new Date() });
    });

    it('sends Expo pushes to active provider/developer tokens and sets alertedAt', async () => {
        prismaMock.expoPushToken.findMany.mockResolvedValue([
            { token: 'ExponentPushToken[aaa]' },
            { token: 'ExponentPushToken[bbb]' },
        ]);

        await notifyModeratorsHighRisk({
            id: 'flag-1',
            sessionId,
            customerEmail: 'patient@example.com',
            severity: 'HIGH',
            status: 'PENDING',
            alertedAt: null,
            aiRecommendation: null,
            humanOverride: null,
            reviewerNotes: null,
            reviewedByUserId: null,
            resolvedByUserId: null,
            flaggedAt: new Date(),
            reviewedAt: null,
            resolvedAt: null,
        });

        expect(prismaMock.expoPushToken.findMany).toHaveBeenCalledWith({
            where: {
                isActive: true,
                user: { type: { in: ['provider', 'developer'] } },
            },
        });
        expect(sendPushMock).toHaveBeenCalledWith([
            expect.objectContaining({
                to: 'ExponentPushToken[aaa]',
                data: { type: 'moderation-high-risk', sessionId },
            }),
            expect.objectContaining({
                to: 'ExponentPushToken[bbb]',
                data: { type: 'moderation-high-risk', sessionId },
            }),
        ]);
        expect(markAlertedMock).toHaveBeenCalledWith(sessionId);
    });

    it('does not spam when alertedAt is already set', async () => {
        await notifyModeratorsHighRisk({
            id: 'flag-1',
            sessionId,
            customerEmail: 'patient@example.com',
            severity: 'HIGH',
            status: 'PENDING',
            alertedAt: new Date('2026-07-18T12:00:00Z'),
            aiRecommendation: null,
            humanOverride: null,
            reviewerNotes: null,
            reviewedByUserId: null,
            resolvedByUserId: null,
            flaggedAt: new Date(),
            reviewedAt: null,
            resolvedAt: null,
        });

        expect(prismaMock.expoPushToken.findMany).not.toHaveBeenCalled();
        expect(sendPushMock).not.toHaveBeenCalled();
        expect(markAlertedMock).not.toHaveBeenCalled();
    });

    it('sets alertedAt even when no moderator tokens exist', async () => {
        prismaMock.expoPushToken.findMany.mockResolvedValue([]);

        await notifyModeratorsHighRisk({
            id: 'flag-1',
            sessionId,
            customerEmail: 'patient@example.com',
            severity: 'HIGH',
            status: 'PENDING',
            alertedAt: null,
            aiRecommendation: null,
            humanOverride: null,
            reviewerNotes: null,
            reviewedByUserId: null,
            resolvedByUserId: null,
            flaggedAt: new Date(),
            reviewedAt: null,
            resolvedAt: null,
        });

        expect(sendPushMock).not.toHaveBeenCalled();
        expect(markAlertedMock).toHaveBeenCalledWith(sessionId);
    });
});

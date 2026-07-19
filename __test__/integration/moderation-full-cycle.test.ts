import { beforeEach, describe, expect, it, vi } from 'vitest';

type FlaggedRow = {
    id: string;
    sessionId: string;
    customerEmail: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'PENDING' | 'IN_REVIEW' | 'RESOLVED';
    aiRecommendation: string | null;
    humanOverride: string | null;
    reviewerNotes: string | null;
    reviewedByUserId: string | null;
    resolvedByUserId: string | null;
    flaggedAt: Date;
    reviewedAt: Date | null;
    resolvedAt: Date | null;
    alertedAt: Date | null;
};

const store = vi.hoisted(() => ({
    rows: new Map<string, FlaggedRow>(),
}));

const { sendPushMock, loggerMock } = vi.hoisted(() => ({
    sendPushMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        flaggedSession: {
            findUnique: vi.fn(async ({ where }: { where: { sessionId: string } }) => {
                return store.rows.get(where.sessionId) ?? null;
            }),
            create: vi.fn(async ({ data }: { data: Omit<FlaggedRow, 'id' | 'flaggedAt'> & Partial<FlaggedRow> }) => {
                const row: FlaggedRow = {
                    id: 'flag-1',
                    sessionId: data.sessionId,
                    customerEmail: data.customerEmail,
                    severity: data.severity ?? 'HIGH',
                    status: data.status ?? 'PENDING',
                    aiRecommendation: data.aiRecommendation ?? null,
                    humanOverride: data.humanOverride ?? null,
                    reviewerNotes: data.reviewerNotes ?? null,
                    reviewedByUserId: data.reviewedByUserId ?? null,
                    resolvedByUserId: data.resolvedByUserId ?? null,
                    flaggedAt: data.flaggedAt ?? new Date('2026-07-18T10:00:00Z'),
                    reviewedAt: data.reviewedAt ?? null,
                    resolvedAt: data.resolvedAt ?? null,
                    alertedAt: data.alertedAt ?? null,
                };
                store.rows.set(row.sessionId, row);
                return { ...row };
            }),
            update: vi.fn(
                async ({
                    where,
                    data,
                }: {
                    where: { sessionId: string };
                    data: Partial<FlaggedRow>;
                }) => {
                    const existing = store.rows.get(where.sessionId);
                    if (!existing) {
                        throw new Error('missing flagged session');
                    }
                    const next = { ...existing, ...data };
                    store.rows.set(where.sessionId, next);
                    return { ...next };
                }
            ),
            updateMany: vi.fn(
                async ({
                    where,
                    data,
                }: {
                    where: { sessionId: string; status?: { not: FlaggedRow['status'] } };
                    data: Partial<FlaggedRow>;
                }) => {
                    const existing = store.rows.get(where.sessionId);
                    if (!existing) {
                        return { count: 0 };
                    }
                    if (where.status?.not && existing.status === where.status.not) {
                        return { count: 0 };
                    }
                    store.rows.set(where.sessionId, { ...existing, ...data });
                    return { count: 1 };
                }
            ),
            findMany: vi.fn(async ({ where }: { where: { status: { in: FlaggedRow['status'][] } } }) => {
                return [...store.rows.values()]
                    .filter((row) => where.status.in.includes(row.status))
                    .sort((a, b) => {
                        const severityRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
                        const severityDiff = severityRank[b.severity] - severityRank[a.severity];
                        if (severityDiff !== 0) return severityDiff;
                        return b.flaggedAt.getTime() - a.flaggedAt.getTime();
                    });
            }),
        },
        expoPushToken: {
            findMany: vi.fn(async () => [{ token: 'ExponentPushToken[moderator]' }]),
        },
    },
}));

vi.mock('@/lib/notifications/expo-client', () => ({
    sendPushNotifications: sendPushMock,
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { notifyModeratorsHighRisk } from '@/lib/moderation/alerts';
import {
    listOpenFlaggedSessions,
    resolveFlaggedSession,
    reviewFlaggedSession,
    upsertFlaggedSessionOnEscalate,
} from '@/lib/moderation/repository';

const sessionId = '11111111-1111-4111-8111-111111111111';

describe('moderation full cycle (escalate → list → review → resolve + alert once)', () => {
    beforeEach(() => {
        store.rows.clear();
        vi.clearAllMocks();
        sendPushMock.mockResolvedValue({ sent: 1, failed: 0, deactivated: 0 });
    });

    it('proves the SCRUM-73–76 path end-to-end against the repository + alert helper', async () => {
        const flagged = await upsertFlaggedSessionOnEscalate({
            sessionId,
            customerEmail: 'patient@example.com',
            escalate: true,
            aiRecommendation: 'Severe mobility decline',
        });

        expect(flagged).toMatchObject({
            sessionId,
            severity: 'HIGH',
            status: 'PENDING',
            alertedAt: null,
        });

        await notifyModeratorsHighRisk(flagged!);
        expect(sendPushMock).toHaveBeenCalledTimes(1);
        expect(sendPushMock).toHaveBeenCalledWith([
            expect.objectContaining({
                data: { type: 'moderation-high-risk', sessionId },
            }),
        ]);
        expect(store.rows.get(sessionId)?.alertedAt).toBeInstanceOf(Date);

        // Re-escalate must not spam moderators.
        const refreshed = await upsertFlaggedSessionOnEscalate({
            sessionId,
            customerEmail: 'patient@example.com',
            escalate: true,
        });
        await notifyModeratorsHighRisk(refreshed!);
        expect(sendPushMock).toHaveBeenCalledTimes(1);

        const openBeforeResolve = await listOpenFlaggedSessions();
        expect(openBeforeResolve).toHaveLength(1);
        expect(openBeforeResolve[0]?.sessionId).toBe(sessionId);

        const reviewed = await reviewFlaggedSession({
            sessionId,
            humanOverride: 'Schedule clinician call',
            reviewerNotes: 'High fall risk',
            reviewedByUserId: 'mod-1',
        });
        expect(reviewed.status).toBe('IN_REVIEW');
        expect(reviewed.humanOverride).toBe('Schedule clinician call');

        const stillOpen = await listOpenFlaggedSessions();
        expect(stillOpen).toHaveLength(1);
        expect(stillOpen[0]?.status).toBe('IN_REVIEW');

        const resolved = await resolveFlaggedSession({
            sessionId,
            resolvedByUserId: 'mod-1',
            resolutionNotes: 'Patient contacted',
        });
        expect(resolved.status).toBe('RESOLVED');

        const openAfterResolve = await listOpenFlaggedSessions();
        expect(openAfterResolve).toHaveLength(0);
    });
});

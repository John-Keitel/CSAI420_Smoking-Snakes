import type { FlaggedSession, ModerationSeverity } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:moderation:repository');

export type UpsertFlaggedSessionArgs = {
    sessionId: string;
    customerEmail: string;
    escalate: boolean;
    aiRecommendation?: string | null;
};

/**
 * Create or refresh a flagged moderation row when the coach escalates.
 * Returns null when escalate is false (no-op).
 */
export async function upsertFlaggedSessionOnEscalate(
    args: UpsertFlaggedSessionArgs
): Promise<FlaggedSession | null> {
    if (!args.escalate) {
        return null;
    }

    const existing = await prisma.flaggedSession.findUnique({
        where: { sessionId: args.sessionId },
    });

    if (!existing) {
        const created = await prisma.flaggedSession.create({
            data: {
                sessionId: args.sessionId,
                customerEmail: args.customerEmail,
                severity: 'HIGH',
                status: 'PENDING',
                aiRecommendation: args.aiRecommendation ?? null,
            },
        });
        logger.info('flagged session created for session %s', args.sessionId);
        return created;
    }

    const reopen = existing.status === 'RESOLVED';
    const updated = await prisma.flaggedSession.update({
        where: { sessionId: args.sessionId },
        data: {
            customerEmail: args.customerEmail,
            severity: 'HIGH' satisfies ModerationSeverity,
            aiRecommendation: args.aiRecommendation ?? existing.aiRecommendation,
            flaggedAt: new Date(),
            ...(reopen
                ? {
                      status: 'PENDING' as const,
                      humanOverride: null,
                      reviewerNotes: null,
                      reviewedByUserId: null,
                      reviewedAt: null,
                      resolvedByUserId: null,
                      resolvedAt: null,
                      alertedAt: null,
                  }
                : {}),
        },
    });
    logger.info('flagged session upserted for session %s (reopen=%s)', args.sessionId, reopen);
    return updated;
}

/** Open moderation queue: PENDING and IN_REVIEW, severity then recency. */
export async function listOpenFlaggedSessions(): Promise<FlaggedSession[]> {
    return prisma.flaggedSession.findMany({
        where: { status: { in: ['PENDING', 'IN_REVIEW'] } },
        orderBy: [{ severity: 'desc' }, { flaggedAt: 'desc' }],
    });
}

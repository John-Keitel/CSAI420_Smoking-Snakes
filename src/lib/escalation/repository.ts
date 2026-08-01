import { randomUUID } from 'node:crypto';

import type { Escalation, EscalationCategory, EscalationPriority, EscalationResponsePreference } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:escalation:repository');

export type CreateEscalationArgs = {
    userId?: string | null;
    sessionId?: string | null;
    phoneNumber: string;
    originalQuestion: string;
    aiResponse: string;
    responsePreference: EscalationResponsePreference;
    waitingForResponse: boolean;
    priority: EscalationPriority;
    category: EscalationCategory;
    questionTimestamp: Date;
};

/**
 * Mint a public escalation identifier.
 *
 * The published contract is `esc_<alphanumeric>`, so the UUID separators are
 * stripped rather than kept — a raw UUID would not satisfy consumers matching
 * on that shape.
 */
export function generateEscalationId(): string {
    return `esc_${randomUUID().replaceAll('-', '')}`;
}

export async function createEscalation(args: CreateEscalationArgs): Promise<Escalation> {
    const escalationId = generateEscalationId();

    const created = await prisma.escalation.create({
        data: {
            escalationId,
            userId: args.userId ?? null,
            sessionId: args.sessionId ?? null,
            phoneNumber: args.phoneNumber,
            originalQuestion: args.originalQuestion,
            aiResponse: args.aiResponse,
            responsePreference: args.responsePreference,
            waitingForResponse: args.waitingForResponse,
            priority: args.priority,
            category: args.category,
            status: 'PENDING',
            questionTimestamp: args.questionTimestamp,
        },
    });

    logger.info('escalation %s created (priority=%s category=%s)', escalationId, args.priority, args.category);
    return created;
}

export async function findEscalationByEscalationId(escalationId: string): Promise<Escalation | null> {
    return prisma.escalation.findUnique({ where: { escalationId } });
}

/** Returns false when nothing matched, so the caller can answer 404. */
export async function deleteEscalationByEscalationId(escalationId: string): Promise<boolean> {
    const deleted = await prisma.escalation.deleteMany({ where: { escalationId } });

    if (deleted.count === 0) {
        return false;
    }

    logger.info('escalation %s deleted', escalationId);
    return true;
}

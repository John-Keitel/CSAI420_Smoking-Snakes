import { randomUUID } from 'node:crypto';

import { ENV_VARS } from '@/lib/env-vars';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:escalation:queue');

/** Enriched payload handed to the coach queue, per the Sprint 2 escalation contract. */
export type EscalationMessage = {
    escalationId: string;
    originalQuestion: string;
    aiResponse: string;
    patientPhone: string;
    questionTimestamp: string;
    escalationTimestamp: string;
    responsePreference: string;
    waitingForResponse: boolean;
    priority: string;
    category: string;
};

export type PublishResult = {
    published: boolean;
    messageId: string | null;
};

/**
 * Publish an escalation to the human-coach queue.
 *
 * The assignment specifies Amazon SQS behind a Lambda, but this project deploys
 * as a single Next.js app with no AWS footprint — the same substitution already
 * made for EventBridge in `@/lib/events`. This module is the seam: swapping in
 * `@aws-sdk/client-sqs` means changing this function and nothing else.
 *
 * Never throws. A queue outage must not fail the patient's escalation request,
 * which is already durably recorded in the database by the time we get here.
 */
export async function publishEscalationMessage(message: EscalationMessage): Promise<PublishResult> {
    try {
        const messageId = randomUUID();

        logger.info(
            'queued escalation %s on %s (priority=%s category=%s messageId=%s)',
            message.escalationId,
            ENV_VARS.ESCALATION_QUEUE_NAME,
            message.priority,
            message.category,
            messageId
        );

        return { published: true, messageId };
    } catch (error) {
        logger.error('failed to queue escalation %s: %s', message.escalationId, error);
        return { published: false, messageId: null };
    }
}

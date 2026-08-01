import type { Escalation, EscalationResponsePreference } from '@/generated/prisma/client';
import { classifyEscalation } from '@/lib/escalation/classifier';
import { publishEscalationMessage } from '@/lib/escalation/queue';
import { createEscalation } from '@/lib/escalation/repository';
import { getAppLogger } from '@/lib/logger';
import type { EscalateQuestionInput } from '@/lib/schemas';
import { stripHtml } from '@/lib/validation';

const logger = getAppLogger('lib:escalation:handler');

const RESPONSE_PREFERENCE_BY_INPUT = {
    call: 'CALL',
    text: 'TEXT',
    chat: 'CHAT',
} as const satisfies Record<EscalateQuestionInput['responsePreference'], EscalationResponsePreference>;

/** Coach SLA quoted back to the patient, by triage lane. */
const ESTIMATED_RESPONSE_TIME = {
    HIGH: '15-30 minutes',
    MEDIUM: '30-60 minutes',
    LOW: '1-2 hours',
} as const;

export type EscalationResult = {
    escalation: Escalation;
    estimatedResponseTime: string;
};

/**
 * Process one escalation end to end: sanitize, triage, persist, publish.
 *
 * This is the workload the assignment places in an AWS Lambda. It runs in-process
 * here (see `@/lib/escalation/queue` for the rationale) but stays a standalone,
 * transport-agnostic function so it could be lifted into a real handler unchanged.
 *
 * The database write is the source of truth and happens before publishing, so a
 * queue failure can be retried without losing the patient's request.
 */
export async function handleEscalation(input: EscalateQuestionInput): Promise<EscalationResult> {
    // Free text arrives from a chatbot relaying patient input; never store it raw.
    const originalQuestion = stripHtml(input.question);
    const aiResponse = stripHtml(input.aiResponse);

    const { priority, category } = classifyEscalation(originalQuestion, aiResponse);

    const escalation = await createEscalation({
        userId: input.userId,
        sessionId: input.sessionId,
        phoneNumber: input.phoneNumber,
        originalQuestion,
        aiResponse,
        responsePreference: RESPONSE_PREFERENCE_BY_INPUT[input.responsePreference],
        waitingForResponse: input.waitingForResponse,
        priority,
        category,
        questionTimestamp: input.timestamp ?? new Date(),
    });

    const result = await publishEscalationMessage({
        escalationId: escalation.escalationId,
        originalQuestion: escalation.originalQuestion,
        aiResponse: escalation.aiResponse,
        patientPhone: escalation.phoneNumber,
        questionTimestamp: escalation.questionTimestamp.toISOString(),
        escalationTimestamp: escalation.escalationTimestamp.toISOString(),
        responsePreference: escalation.responsePreference.toLowerCase(),
        waitingForResponse: escalation.waitingForResponse,
        priority: escalation.priority.toLowerCase(),
        category: escalation.category.toLowerCase(),
    });

    if (!result.published) {
        logger.warn('escalation %s stored but not queued; coach notification is delayed', escalation.escalationId);
    }

    return {
        escalation,
        estimatedResponseTime: ESTIMATED_RESPONSE_TIME[escalation.priority],
    };
}

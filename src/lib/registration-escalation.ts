import type { Escalation, EscalationCategory, EscalationPriority, EscalationResponsePreference } from '@/generated/prisma/client';
import { publishEscalationMessage } from '@/lib/escalation/queue';
import { createEscalation } from '@/lib/escalation/repository';
import { getAppLogger } from '@/lib/logger';
import type { RegistrationEscalationInput } from '@/lib/schemas/registration-escalation.schema';
import { stripHtml } from '@/lib/validation';

const logger = getAppLogger('lib:registration-escalation');

/** Coach SLA quoted back to the caller, by triage lane (mirrors `@/lib/escalation/handler`). */
export const ESTIMATED_RESPONSE_TIME = {
    HIGH: '15-30 minutes',
    MEDIUM: '30-60 minutes',
    LOW: '1-2 hours',
} as const;

const RESPONSE_PREFERENCE_BY_INPUT = {
    call: 'CALL',
    text: 'TEXT',
    chat: 'CHAT',
} as const satisfies Record<RegistrationEscalationInput['responsePreference'], EscalationResponsePreference>;

/**
 * Week 5 contract: issueType drives the triage lane directly. The shared
 * classifier stays untouched — it would give technical issues MEDIUM, while
 * the suite requires the exact "15-30 minutes" HIGH SLA.
 */
const TRIAGE_BY_ISSUE_TYPE: Record<RegistrationEscalationInput['issueType'], { priority: EscalationPriority; category: EscalationCategory }> = {
    technical_difficulties: { priority: 'HIGH', category: 'TECHNICAL' },
    confusion_about_process: { priority: 'MEDIUM', category: 'GENERAL' },
    account_creation_failed: { priority: 'MEDIUM', category: 'GENERAL' },
    validation_error: { priority: 'MEDIUM', category: 'GENERAL' },
};

export type RegistrationEscalationResult = {
    escalation: Escalation;
    estimatedResponseTime: string;
};

function deriveOriginalQuestion(input: RegistrationEscalationInput): string {
    const context = input.conversationContext ?? [];
    const lastUserMessage = [...context].reverse().find((entry) => entry.role === 'user')?.message;

    if (lastUserMessage) {
        return lastUserMessage;
    }

    if (input.registrationData) {
        return JSON.stringify(input.registrationData);
    }

    return 'Registration assistance requested';
}

/**
 * Persist a registration escalation with issueType-driven triage, then publish
 * it to the coach queue. Queue failures never fail the request — the database
 * row is the source of truth (same policy as `handleEscalation`).
 */
export async function handleRegistrationEscalation(input: RegistrationEscalationInput): Promise<RegistrationEscalationResult> {
    const originalQuestion = stripHtml(deriveOriginalQuestion(input));
    const aiResponse = stripHtml(input.aiResponse ?? 'Registration could not be completed by the assistant.');

    const { priority, category } = TRIAGE_BY_ISSUE_TYPE[input.issueType];

    const escalation = await createEscalation({
        userId: null,
        sessionId: input.chatSessionId,
        phoneNumber: input.phoneNumber,
        originalQuestion,
        aiResponse,
        responsePreference: RESPONSE_PREFERENCE_BY_INPUT[input.responsePreference],
        waitingForResponse: true,
        priority,
        category,
        questionTimestamp: new Date(),
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
        estimatedResponseTime: ESTIMATED_RESPONSE_TIME[priority],
    };
}

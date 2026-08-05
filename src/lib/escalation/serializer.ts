import type { Escalation } from '@/generated/prisma/client';

/**
 * Public view of an escalation. Enum columns are lowercased because the API
 * contract publishes `pending` / `high` / `medical`, while the database stores
 * them in the project's SCREAMING_CASE convention.
 */
export type EscalationStatusResponse = {
    escalationId: string;
    status: string;
    priority: string;
    category: string;
    originalQuestion: string;
    aiResponse: string;
    phoneNumber: string;
    responsePreference: string;
    waitingForResponse: boolean;
    questionTimestamp: string;
    escalationTimestamp: string;
    resolutionTimestamp: string | null;
    coachId: string | null;
    sessionId: string | null;
    userId: string | null;
};

export function toEscalationStatusResponse(escalation: Escalation): EscalationStatusResponse {
    return {
        escalationId: escalation.escalationId,
        status: escalation.status.toLowerCase(),
        priority: escalation.priority.toLowerCase(),
        category: escalation.category.toLowerCase(),
        originalQuestion: escalation.originalQuestion,
        aiResponse: escalation.aiResponse,
        phoneNumber: escalation.phoneNumber,
        responsePreference: escalation.responsePreference.toLowerCase(),
        waitingForResponse: escalation.waitingForResponse,
        questionTimestamp: escalation.questionTimestamp.toISOString(),
        escalationTimestamp: escalation.escalationTimestamp.toISOString(),
        resolutionTimestamp: escalation.resolutionTimestamp?.toISOString() ?? null,
        coachId: escalation.coachId,
        sessionId: escalation.sessionId,
        userId: escalation.userId,
    };
}

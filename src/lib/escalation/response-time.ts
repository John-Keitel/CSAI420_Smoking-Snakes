import type { EscalationPriority } from '@/generated/prisma/client';

// Shared by both POST /escalate-question and POST /escalate-registration so the same priority
// always resolves to the same estimated-response-time copy across the escalation subsystem.
export const ESTIMATED_RESPONSE_TIME_BY_PRIORITY: Record<EscalationPriority, string> = {
    high: '15-30 minutes',
    medium: '1-2 hours',
    low: '4-24 hours',
};

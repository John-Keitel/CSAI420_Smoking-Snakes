import type { EscalationIssueType, EscalationPriority } from '@/generated/prisma/client';

export const ESCALATION_ISSUE_TYPES = [
    'confusion_about_process',
    'technical_difficulties',
    'account_creation_failed',
    'validation_errors',
] as const satisfies readonly EscalationIssueType[];

export type IssueTypeClassification = {
    priority: EscalationPriority;
    category: string;
};

/**
 * Registration escalations (POST /escalate-registration) classify by the issueType the caller
 * already determined, unlike question escalations (POST /escalate-question) which infer
 * priority/category from free text via classifyEscalation. technical_difficulties must map to
 * 'high' so ESTIMATED_RESPONSE_TIME_BY_PRIORITY resolves it to exactly '15-30 minutes';
 * account_creation_failed is 'high' too since it blocks signup outright.
 */
const ISSUE_TYPE_CLASSIFICATION: Record<EscalationIssueType, IssueTypeClassification> = {
    confusion_about_process: { priority: 'medium', category: 'registration' },
    technical_difficulties: { priority: 'high', category: 'registration' },
    account_creation_failed: { priority: 'high', category: 'registration' },
    validation_errors: { priority: 'medium', category: 'registration' },
};

export function classifyByIssueType(issueType: EscalationIssueType): IssueTypeClassification {
    return ISSUE_TYPE_CLASSIFICATION[issueType];
}

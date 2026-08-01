export type { EscalationCategory, EscalationClassification } from '@/lib/escalation/classify';
export { classifyEscalation } from '@/lib/escalation/classify';
export { generateEscalationId } from '@/lib/escalation/id';
export { ESCALATION_ISSUE_TYPES, classifyByIssueType, type IssueTypeClassification } from '@/lib/escalation/issue-type';
export {
    createEscalation,
    createRegistrationEscalation,
    deleteEscalationByEscalationId,
    getEscalationByEscalationId,
    type CreateEscalationArgs,
    type CreateRegistrationEscalationArgs,
} from '@/lib/escalation/repository';
export { ESTIMATED_RESPONSE_TIME_BY_PRIORITY } from '@/lib/escalation/response-time';
export { sanitizeText } from '@/lib/escalation/sanitize';

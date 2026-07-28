export type { EscalationCategory, EscalationClassification } from '@/lib/escalation/classify';
export { classifyEscalation } from '@/lib/escalation/classify';
export { generateEscalationId } from '@/lib/escalation/id';
export {
    createEscalation,
    deleteEscalationByEscalationId,
    getEscalationByEscalationId,
    type CreateEscalationArgs,
} from '@/lib/escalation/repository';
export { sanitizeText } from '@/lib/escalation/sanitize';

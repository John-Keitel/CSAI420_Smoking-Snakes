export { classifyEscalation, type EscalationTriage } from '@/lib/escalation/classifier';
export { type EscalationResult, handleEscalation } from '@/lib/escalation/handler';
export { type EscalationMessage, publishEscalationMessage, type PublishResult } from '@/lib/escalation/queue';
export {
    createEscalation,
    type CreateEscalationArgs,
    deleteEscalationByEscalationId,
    findEscalationByEscalationId,
    generateEscalationId,
} from '@/lib/escalation/repository';
export { type EscalationStatusResponse, toEscalationStatusResponse } from '@/lib/escalation/serializer';

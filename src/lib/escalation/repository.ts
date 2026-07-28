import type { Escalation, EscalationResponsePreference } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { classifyEscalation } from '@/lib/escalation/classify';
import { generateEscalationId } from '@/lib/escalation/id';
import { sanitizeText } from '@/lib/escalation/sanitize';
import { HttpException } from '@/lib/http';

export type CreateEscalationArgs = {
    userId?: string;
    phoneNumber: string;
    question: string;
    aiResponse: string;
    responsePreference: EscalationResponsePreference;
    waitingForResponse?: boolean;
    questionTimestamp?: Date;
};

export async function createEscalation(args: CreateEscalationArgs): Promise<Escalation> {
    const originalQuestion = sanitizeText(args.question);
    const aiResponse = sanitizeText(args.aiResponse);
    const { priority, category } = classifyEscalation(originalQuestion, aiResponse);

    return prisma.escalation.create({
        data: {
            escalationId: generateEscalationId(),
            userId: args.userId,
            phoneNumber: args.phoneNumber,
            originalQuestion,
            aiResponse,
            responsePreference: args.responsePreference,
            waitingForResponse: args.waitingForResponse ?? false,
            questionTimestamp: args.questionTimestamp,
            priority,
            category,
        },
    });
}

export async function getEscalationByEscalationId(escalationId: string): Promise<Escalation> {
    const escalation = await prisma.escalation.findUnique({ where: { escalationId } });

    if (!escalation) {
        throw new HttpException(404, 'Escalation not found');
    }

    return escalation;
}

export async function deleteEscalationByEscalationId(escalationId: string): Promise<void> {
    await prisma.escalation.deleteMany({ where: { escalationId } });
}

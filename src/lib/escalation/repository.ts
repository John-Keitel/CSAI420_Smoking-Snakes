import type { Escalation, EscalationIssueType, EscalationResponsePreference, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { classifyEscalation } from '@/lib/escalation/classify';
import { generateEscalationId } from '@/lib/escalation/id';
import { classifyByIssueType } from '@/lib/escalation/issue-type';
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

export type CreateRegistrationEscalationArgs = {
    phoneNumber: string;
    issueType: EscalationIssueType;
    aiResponse: string;
    responsePreference: EscalationResponsePreference;
    // Callers get these off a Zod z.record(z.string(), z.unknown()) parse (see
    // EscalateRegistrationSchema), not off Prisma.InputJsonValue directly — cast at this
    // boundary instead of pushing the Prisma-specific type onto every caller.
    registrationData?: Record<string, unknown>;
    conversationContext?: unknown;
};

export async function createRegistrationEscalation(args: CreateRegistrationEscalationArgs): Promise<Escalation> {
    const aiResponse = sanitizeText(args.aiResponse);
    const { priority, category } = classifyByIssueType(args.issueType);

    return prisma.escalation.create({
        data: {
            escalationId: generateEscalationId(),
            phoneNumber: args.phoneNumber,
            aiResponse,
            issueType: args.issueType,
            registrationData: args.registrationData as Prisma.InputJsonValue | undefined,
            conversationContext: args.conversationContext as Prisma.InputJsonValue | undefined,
            responsePreference: args.responsePreference,
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

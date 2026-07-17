import { ChatMessage, ChatMessageSender, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

export async function findOrCreateSession(customerEmail: string): Promise<string> {
    try {
        const latestSession = await prisma.chatSession.findFirst({
            where: { customerEmail },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        if (latestSession) {
            return latestSession.id;
        }

        const customer = await prisma.user.findUnique({
            where: { email: customerEmail },
            select: { id: true },
        });

        if (!customer) {
            throw new Error(`Cannot create chat session because user was not found for email: ${customerEmail}`);
        }

        const newSession = await prisma.chatSession.create({
            data: { customerEmail },
            select: { id: true },
        });

        return newSession.id;
    } catch (error) {
        console.error('[chat-history-repository] Failed to find or create chat session', {
            customerEmail,
            error,
        });
        throw error;
    }
}

export async function saveUserMessage(sessionId: string, content: string): Promise<ChatMessage> {
    try {
        return await prisma.chatMessage.create({
            data: {
                sessionId,
                content,
                sender: ChatMessageSender.user,
            },
        });
    } catch (error) {
        console.error('[chat-history-repository] Failed to save user message', {
            sessionId,
            contentPreview: content.slice(0, 120),
            error,
        });
        throw error;
    }
}

export async function saveAiResponse(sessionId: string, content: string, metadata: any): Promise<ChatMessage> {
    try {
        return await prisma.chatMessage.create({
            data: {
                sessionId,
                content,
                sender: ChatMessageSender.ai,
                metadata: metadata as Prisma.InputJsonValue,
            },
        });
    } catch (error) {
        console.error('[chat-history-repository] Failed to save AI response', {
            sessionId,
            contentPreview: content.slice(0, 120),
            metadata,
            error,
        });
        throw error;
    }
}

export async function getLatestSessionMessages(customerEmail: string): Promise<ChatMessage[]> {
    try {
        const latestSession = await prisma.chatSession.findFirst({
            where: { customerEmail },
            orderBy: { createdAt: 'desc' },
            select: { id: true },
        });

        if (!latestSession) {
            return [];
        }

        return await prisma.chatMessage.findMany({
            where: { sessionId: latestSession.id },
            orderBy: { createdAt: 'asc' },
        });
    } catch (error) {
        console.error('[chat-history-repository] Failed to get latest session messages', {
            customerEmail,
            error,
        });
        throw error;
    }
}
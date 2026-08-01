import type { ChatRegistrationSession } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

export type ChatContextEntry = {
    role: 'user' | 'assistant';
    message: string;
};

export const INITIAL_CHAT_STEP = 'initial_greeting';

export async function getOrCreateChatSession(chatSessionId: string): Promise<ChatRegistrationSession> {
    const existing = await prisma.chatRegistrationSession.findUnique({ where: { chatSessionId } });

    if (existing) {
        return existing;
    }

    return prisma.chatRegistrationSession.create({
        data: {
            chatSessionId,
            conversationContext: [],
            currentStep: INITIAL_CHAT_STEP,
        },
    });
}

export async function updateChatSession(
    chatSessionId: string,
    data: { conversationContext: ChatContextEntry[]; currentStep: string }
): Promise<void> {
    await prisma.chatRegistrationSession.update({
        where: { chatSessionId },
        data: {
            conversationContext: data.conversationContext,
            currentStep: data.currentStep,
            lastActivity: new Date(),
        },
    });
}

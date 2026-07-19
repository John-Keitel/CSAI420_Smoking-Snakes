import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

import { ChatMessage, ChatMessageSender, Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';

const CHAT_ENCRYPTION_ALGORITHM = 'aes-256-cbc';

function getEncryptionSecret(): string {
    const secret = process.env.CHAT_ENCRYPTION_KEY;

    if (!secret) {
        throw new Error('CHAT_ENCRYPTION_KEY is not configured');
    }

    return secret;
}

function getEncryptionKey(secret: string): Buffer {
    return createHash('sha256').update(secret).digest();
}

function encryptText(text: string): string {
    const secret = getEncryptionSecret();
    const key = getEncryptionKey(secret);
    const iv = randomBytes(16);
    const cipher = createCipheriv(CHAT_ENCRYPTION_ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);

    return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptText(cryptoText: string): string {
    const secret = getEncryptionSecret();
    const key = getEncryptionKey(secret);
    const [ivHex, encryptedHex] = cryptoText.split(':');

    if (!ivHex || !encryptedHex) {
        throw new Error('Invalid encrypted message format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = createDecipheriv(CHAT_ENCRYPTION_ALGORITHM, key, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

    return decrypted.toString('utf8');
}

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
        const encryptedContent = encryptText(content);

        return await prisma.chatMessage.create({
            data: {
                sessionId,
                content: encryptedContent,
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
        const encryptedContent = encryptText(content);

        return await prisma.chatMessage.create({
            data: {
                sessionId,
                content: encryptedContent,
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

        const messages = await prisma.chatMessage.findMany({
            where: { sessionId: latestSession.id },
            orderBy: { createdAt: 'asc' },
        });

        return messages.map((message) => ({
            ...message,
            content: decryptText(message.content),
        }));
    } catch (error) {
        console.error('[chat-history-repository] Failed to get latest session messages', {
            customerEmail,
            error,
        });
        throw error;
    }
}
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

type CreatedMessage = {
    id: string;
    sessionId: string;
    sender: 'user' | 'ai' | 'system';
    content: string;
    metadata: unknown;
    createdAt: Date;
};

async function loadChatHistoryRepository(options?: { latestSessionId?: string | null; findManyMessages?: CreatedMessage[] }) {
    vi.resetModules();

    const createdMessages: CreatedMessage[] = [];
    const chatSessionFindFirstMock = vi
        .fn()
        .mockResolvedValue(options?.latestSessionId === null ? null : { id: options?.latestSessionId ?? 'session-1' });

    const chatMessageCreateMock = vi.fn().mockImplementation(async ({ data }: { data: CreatedMessage }) => {
        const createdMessage: CreatedMessage = {
            id: `msg-${createdMessages.length + 1}`,
            sessionId: data.sessionId,
            sender: data.sender,
            content: data.content,
            metadata: data.metadata ?? null,
            createdAt: new Date(),
        };

        createdMessages.push(createdMessage);
        return createdMessage;
    });

    const chatMessageFindManyMock = vi.fn().mockImplementation(async () => {
        if (options?.findManyMessages) {
            return options.findManyMessages;
        }

        return createdMessages;
    });

    vi.doMock('@/lib/db', () => ({
        prisma: {
            chatSession: {
                findFirst: chatSessionFindFirstMock,
            },
            user: {
                findUnique: vi.fn(),
            },
            chatMessage: {
                create: chatMessageCreateMock,
                findMany: chatMessageFindManyMock,
            },
        },
    }));

    const repository = await import('@/lib/chat-history-repository');

    return {
        repository,
        chatMessageCreateMock,
        chatMessageFindManyMock,
        chatSessionFindFirstMock,
        createdMessages,
    };
}

describe('chat-history-repository encryption', () => {
    const originalEncryptionKey = process.env.CHAT_ENCRYPTION_KEY;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Encryption Round-Trip: should encrypt plaintext as ivHex:cipherHex and decrypt back to original text', async () => {
        process.env.CHAT_ENCRYPTION_KEY = 'scrum-66-roundtrip-key';

        const { repository, chatMessageCreateMock } = await loadChatHistoryRepository();

        const plainText = 'Paciente apresenta boa estabilidade';

        await repository.saveUserMessage('session-1', plainText);

        expect(chatMessageCreateMock).toHaveBeenCalledOnce();

        const encryptedContent = chatMessageCreateMock.mock.calls[0][0].data.content as string;
        expect(encryptedContent).not.toBe(plainText);
        expect(encryptedContent).toMatch(/^[0-9a-f]+:[0-9a-f]+$/i);

        const messages = await repository.getLatestSessionMessages('patient@example.com');

        expect(messages).toHaveLength(1);
        expect(messages[0].content).toBe(plainText);
    });

    it('Key Integrity Guard: should fail to decrypt an existing encrypted message when CHAT_ENCRYPTION_KEY changes', async () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        process.env.CHAT_ENCRYPTION_KEY = 'key-before-rotation';

        const { repository, createdMessages } = await loadChatHistoryRepository();

        const plainText = 'Paciente apresenta boa estabilidade';
        await repository.saveUserMessage('session-1', plainText);

        expect(createdMessages).toHaveLength(1);

        process.env.CHAT_ENCRYPTION_KEY = 'key-after-rotation';

        await expect(repository.getLatestSessionMessages('patient@example.com')).rejects.toThrow();

        consoleErrorSpy.mockRestore();
    });

    afterAll(() => {
        process.env.CHAT_ENCRYPTION_KEY = originalEncryptionKey;
    });
});

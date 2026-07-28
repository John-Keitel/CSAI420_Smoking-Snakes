import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, loggerMock } = vi.hoisted(() => ({
    prismaMock: {
        escalation: {
            create: vi.fn(),
            findUnique: vi.fn(),
            deleteMany: vi.fn(),
        },
    },
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { createEscalation, deleteEscalationByEscalationId, getEscalationByEscalationId } from '@/lib/escalation/repository';
import { HttpException } from '@/lib/http';

describe('createEscalation', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('sanitizes text, classifies, and persists with a generated escalationId', async () => {
        prismaMock.escalation.create.mockImplementation(({ data }) => Promise.resolve({ id: 'row-1', ...data }));

        const result = await createEscalation({
            userId: 'user_67890',
            phoneNumber: '+1234567890',
            question: '<script>alert(1)</script>chest pain right now',
            aiResponse: 'cannot advise on chest pain',
            responsePreference: 'call',
            waitingForResponse: true,
        });

        expect(prismaMock.escalation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                escalationId: expect.stringMatching(/^esc_[a-f0-9]+$/),
                userId: 'user_67890',
                phoneNumber: '+1234567890',
                originalQuestion: 'chest pain right now',
                aiResponse: 'cannot advise on chest pain',
                responsePreference: 'call',
                waitingForResponse: true,
                priority: 'high',
                category: 'medical',
            }),
        });
        expect(result.originalQuestion).not.toContain('<script>');
    });

    it('defaults waitingForResponse to false when omitted', async () => {
        prismaMock.escalation.create.mockImplementation(({ data }) => Promise.resolve({ id: 'row-1', ...data }));

        await createEscalation({
            phoneNumber: '+1987654321',
            question: 'The app keeps crashing',
            aiResponse: 'unable to diagnose technical issues',
            responsePreference: 'chat',
        });

        expect(prismaMock.escalation.create).toHaveBeenCalledWith({
            data: expect.objectContaining({ waitingForResponse: false, priority: 'medium', category: 'technical' }),
        });
    });
});

describe('getEscalationByEscalationId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns the escalation when found', async () => {
        const row = { id: 'row-1', escalationId: 'esc_abc123' };
        prismaMock.escalation.findUnique.mockResolvedValue(row);

        const result = await getEscalationByEscalationId('esc_abc123');

        expect(result).toEqual(row);
        expect(prismaMock.escalation.findUnique).toHaveBeenCalledWith({ where: { escalationId: 'esc_abc123' } });
    });

    it('throws 404 when not found', async () => {
        prismaMock.escalation.findUnique.mockResolvedValue(null);

        await expect(getEscalationByEscalationId('esc_nonexistent123')).rejects.toMatchObject({
            statusCode: 404,
        } satisfies Partial<HttpException>);
    });
});

describe('deleteEscalationByEscalationId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('deletes by escalationId', async () => {
        prismaMock.escalation.deleteMany.mockResolvedValue({ count: 1 });

        await deleteEscalationByEscalationId('esc_abc123');

        expect(prismaMock.escalation.deleteMany).toHaveBeenCalledWith({ where: { escalationId: 'esc_abc123' } });
    });
});

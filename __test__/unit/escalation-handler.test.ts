import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createEscalationMock, publishEscalationMessageMock, loggerMock } = vi.hoisted(() => ({
    createEscalationMock: vi.fn(),
    publishEscalationMessageMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/escalation/repository', () => ({ createEscalation: createEscalationMock }));
vi.mock('@/lib/escalation/queue', () => ({ publishEscalationMessage: publishEscalationMessageMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { handleEscalation } from '@/lib/escalation/handler';
import type { EscalateQuestionInput } from '@/lib/schemas';

const questionTimestamp = new Date('2026-07-26T14:30:00.000Z');
const escalationTimestamp = new Date('2026-07-26T14:30:15.000Z');

const input: EscalateQuestionInput = {
    phoneNumber: '+1234567890',
    question: "I'm having chest pain after my balance test, should I be worried?",
    aiResponse: 'I cannot provide medical advice about chest pain. Let me connect you with a healthcare professional.',
    responsePreference: 'call',
    waitingForResponse: true,
    timestamp: questionTimestamp,
    sessionId: 'session_medical_123',
    userId: 'user_67890',
};

function storedEscalation(overrides: Record<string, unknown> = {}) {
    return {
        escalationId: 'esc_abc123',
        originalQuestion: input.question,
        aiResponse: input.aiResponse,
        phoneNumber: input.phoneNumber,
        responsePreference: 'CALL',
        waitingForResponse: true,
        priority: 'HIGH',
        category: 'MEDICAL',
        questionTimestamp,
        escalationTimestamp,
        ...overrides,
    };
}

describe('handleEscalation', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        createEscalationMock.mockResolvedValue(storedEscalation());
        publishEscalationMessageMock.mockResolvedValue({ published: true, messageId: 'msg-1' });
    });

    it('triages a clinical question and persists it as high priority', async () => {
        await handleEscalation(input);

        expect(createEscalationMock).toHaveBeenCalledWith(
            expect.objectContaining({
                priority: 'HIGH',
                category: 'MEDICAL',
                responsePreference: 'CALL',
                phoneNumber: '+1234567890',
                userId: 'user_67890',
                sessionId: 'session_medical_123',
                questionTimestamp,
            })
        );
    });

    it('quotes an SLA matching the assigned priority', async () => {
        const { estimatedResponseTime } = await handleEscalation(input);
        expect(estimatedResponseTime).toBe('15-30 minutes');

        createEscalationMock.mockResolvedValue(storedEscalation({ priority: 'MEDIUM', category: 'TECHNICAL' }));
        const technical = await handleEscalation({ ...input, question: 'The app keeps crashing' });
        expect(technical.estimatedResponseTime).toBe('30-60 minutes');
    });

    it('strips markup before the text is stored', async () => {
        await handleEscalation({
            ...input,
            question: '<script>alert("xss")</script>This is a test question',
            aiResponse: '<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>',
        });

        const [args] = createEscalationMock.mock.calls[0];
        expect(args.originalQuestion).not.toContain('<script>');
        expect(args.aiResponse).not.toContain('<!DOCTYPE');
    });

    it('publishes the enriched message to the coach queue after persisting', async () => {
        await handleEscalation(input);

        expect(publishEscalationMessageMock).toHaveBeenCalledWith(
            expect.objectContaining({
                escalationId: 'esc_abc123',
                patientPhone: '+1234567890',
                priority: 'high',
                category: 'medical',
                responsePreference: 'call',
                questionTimestamp: questionTimestamp.toISOString(),
                escalationTimestamp: escalationTimestamp.toISOString(),
            })
        );
    });

    it('still succeeds when the queue is unavailable', async () => {
        // The row is already committed, so a queue outage must not fail the
        // patient's request — it only delays the coach notification.
        publishEscalationMessageMock.mockResolvedValue({ published: false, messageId: null });

        const { escalation } = await handleEscalation(input);

        expect(escalation.escalationId).toBe('esc_abc123');
        expect(loggerMock.warn).toHaveBeenCalled();
    });

    it('defaults the question timestamp when the caller omits it', async () => {
        await handleEscalation({ ...input, timestamp: undefined });

        const [args] = createEscalationMock.mock.calls[0];
        expect(args.questionTimestamp).toBeInstanceOf(Date);
    });
});

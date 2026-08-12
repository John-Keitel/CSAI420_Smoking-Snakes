import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, loggerMock, putEventsCommandCtorMock, routeToDlqMock, recordDurationMock, recordOutcomeMock } = vi.hoisted(() => ({
    sendMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    putEventsCommandCtorMock: vi.fn(),
    routeToDlqMock: vi.fn(),
    recordDurationMock: vi.fn(),
    recordOutcomeMock: vi.fn(),
}));

vi.mock('@aws-sdk/client-eventbridge', () => {
    class EventBridgeClient {
        send = sendMock;
    }

    class PutEventsCommand {
        input: unknown;

        constructor(input: unknown) {
            this.input = input;
            putEventsCommandCtorMock(input);
        }
    }

    return {
        EventBridgeClient,
        PutEventsCommand,
    };
});

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => loggerMock,
}));

vi.mock('@/lib/events/dlq-handler', () => ({
    routeUserRegisteredEventToDlq: routeToDlqMock,
}));

vi.mock('@/lib/events/telemetry', () => ({
    recordOnboardingDuration: recordDurationMock,
    recordOnboardingOutcome: recordOutcomeMock,
}));

import { publishUserRegisteredEvent } from '@/lib/events/publisher';
import { UserRegisteredViaChatEventSchema } from '@/lib/events/schemas/user-registered-event.schema';

describe('events pipeline - EPIC 15', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        routeToDlqMock.mockResolvedValue(undefined);
    });

    it('publishes UserRegisteredViaChat with valid payload schema', async () => {
        sendMock.mockResolvedValue({ FailedEntryCount: 0, Entries: [{ EventId: 'evt-1' }] });

        const payload = {
            userId: 'user-123',
            email: 'person@example.com',
            method: 'chat' as const,
            timestamp: '2026-08-11T10:00:00.000Z',
            durationSeconds: 12,
        };

        expect(UserRegisteredViaChatEventSchema.parse(payload)).toEqual(payload);

        await publishUserRegisteredEvent(payload);

        expect(sendMock).toHaveBeenCalledTimes(1);
        expect(putEventsCommandCtorMock).toHaveBeenCalledTimes(1);

        const commandInput = putEventsCommandCtorMock.mock.calls[0][0] as {
            Entries: Array<{
                EventBusName: string;
                Source: string;
                DetailType: string;
                Detail: string;
            }>;
        };

        expect(commandInput.Entries[0].EventBusName).toBe('stedi.user.events');
        expect(commandInput.Entries[0].Source).toBe('stedi.user.onboarding');
        expect(commandInput.Entries[0].DetailType).toBe('UserRegisteredViaChat');
        expect(JSON.parse(commandInput.Entries[0].Detail)).toEqual(payload);

        expect(recordDurationMock).toHaveBeenCalledWith(12, 'chat');
        expect(recordOutcomeMock).toHaveBeenCalledWith(true, 'chat');
        expect(routeToDlqMock).not.toHaveBeenCalled();
    });

    it('retries transient AWS failure, does not throw, and logs the failure path', async () => {
        const transientError = Object.assign(new Error('network timeout'), { name: 'TimeoutError' });
        sendMock.mockRejectedValue(transientError);

        await expect(
            publishUserRegisteredEvent({
                userId: 'user-456',
                email: 'person2@example.com',
                method: 'chat',
                timestamp: '2026-08-11T10:00:00.000Z',
                durationSeconds: 8,
            })
        ).resolves.toBeUndefined();

        expect(sendMock).toHaveBeenCalledTimes(3);
        expect(loggerMock.warn).toHaveBeenCalled();
        expect(loggerMock.error).toHaveBeenCalledWith(
            'user-registered event publication exhausted retries userId=%s attempts=%d',
            'user-456',
            3
        );
        expect(recordOutcomeMock).toHaveBeenCalledWith(false, 'chat');
    });

    it('routes failed event to DLQ after retry exhaustion', async () => {
        const transientError = Object.assign(new Error('service unavailable'), {
            name: 'ServiceUnavailableException',
        });
        sendMock.mockRejectedValue(transientError);

        await publishUserRegisteredEvent({
            userId: 'user-789',
            email: 'person3@example.com',
            method: 'chat',
            timestamp: '2026-08-11T10:00:00.000Z',
            durationSeconds: 5,
        });

        expect(routeToDlqMock).toHaveBeenCalledTimes(1);
        expect(routeToDlqMock).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'UserRegisteredViaChat',
                attempts: 3,
                reason: 'service unavailable',
                payload: expect.objectContaining({
                    userId: 'user-789',
                    method: 'chat',
                }),
            })
        );
    });
});

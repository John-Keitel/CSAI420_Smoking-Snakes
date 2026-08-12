import { getAppLogger } from '@/lib/logger';

import { UserRegisteredViaChatEvent } from './schemas/user-registered-event.schema';

const logger = getAppLogger('lib:events:dlq-handler');

export type UserRegisteredEventDlqMessage = {
    eventType: 'UserRegisteredViaChat';
    attempts: number;
    failedAt: string;
    reason: string;
    payload: UserRegisteredViaChatEvent;
};

export async function routeUserRegisteredEventToDlq(message: UserRegisteredEventDlqMessage): Promise<void> {
    // Simulated SQS DLQ enqueue. Keep logs metadata-only to avoid exposing PII.
    logger.error(
        'user-registered event moved to DLQ eventType=%s userId=%s attempts=%d reason=%s failedAt=%s',
        message.eventType,
        message.payload.userId,
        message.attempts,
        message.reason,
        message.failedAt
    );
}

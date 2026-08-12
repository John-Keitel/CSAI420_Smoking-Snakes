import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';

import { EVENT_BUS_NAME } from '@/lib/events/config';
import { routeUserRegisteredEventToDlq } from '@/lib/events/dlq-handler';
import { UserRegisteredViaChatEventSchema } from '@/lib/events/schemas/user-registered-event.schema';
import { recordOnboardingDuration, recordOnboardingOutcome } from '@/lib/events/telemetry';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:events:publisher');
const eventBridgeClient = new EventBridgeClient({});

const MAX_RETRIES = 3;

function isTransientError(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }

    const transientNames = new Set([
        'TimeoutError',
        'NetworkingError',
        'ThrottlingException',
        'ServiceUnavailableException',
        'InternalFailure',
        'RequestTimeout',
    ]);

    return transientNames.has(error.name);
}

function waitBeforeRetry(attempt: number): Promise<void> {
    const backoffMs = Math.min(100 * attempt, 300);
    return new Promise((resolve) => {
        setTimeout(resolve, backoffMs);
    });
}

export async function publishUserRegisteredEvent(payload: unknown): Promise<void> {
    const parsed = UserRegisteredViaChatEventSchema.safeParse(payload);

    if (!parsed.success) {
        logger.warn('user-registered event dropped due to invalid schema');
        return;
    }

    const event = parsed.data;
    const detail = JSON.stringify(event);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
        try {
            await eventBridgeClient.send(
                new PutEventsCommand({
                    Entries: [
                        {
                            EventBusName: EVENT_BUS_NAME,
                            Source: 'stedi.user.onboarding',
                            DetailType: 'UserRegisteredViaChat',
                            Detail: detail,
                        },
                    ],
                })
            );

            recordOnboardingDuration(event.durationSeconds, event.method);
            recordOnboardingOutcome(true, event.method);
            logger.info('user-registered event published userId=%s attempt=%d', event.userId, attempt);
            return;
        } catch (error) {
            const shouldRetry = attempt < MAX_RETRIES && isTransientError(error);

            logger.warn(
                'user-registered publish failed userId=%s attempt=%d retry=%s reason=%s',
                event.userId,
                attempt,
                shouldRetry ? 'true' : 'false',
                error instanceof Error ? error.message : 'unknown'
            );

            if (shouldRetry) {
                await waitBeforeRetry(attempt);
                continue;
            }

            recordOnboardingOutcome(false, event.method);

            await routeUserRegisteredEventToDlq({
                eventType: 'UserRegisteredViaChat',
                attempts: attempt,
                failedAt: new Date().toISOString(),
                reason: error instanceof Error ? error.message : 'unknown',
                payload: event,
            });

            logger.error('user-registered event publication exhausted retries userId=%s attempts=%d', event.userId, attempt);
            return;
        }
    }
}

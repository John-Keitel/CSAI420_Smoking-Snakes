import { getAppLogger } from '@/lib/logger';
import { handlePostTestCompleted } from '@/lib/notifications/post-test-push';

const logger = getAppLogger('lib:events');

/**
 * Emitted after a rapid step test completes successfully. Carries just enough
 * context for downstream handlers to look up the customer and call the legacy
 * API on their behalf.
 */
export type PostTestCompletedEvent = {
    customerEmail: string;
    sessionToken: string;
};

/**
 * Fire-and-forget dispatch of the post-test-completed event.
 *
 * The original ticket (SCRUM-55) called for AWS EventBridge + Lambda, but this
 * project runs on Vercel/Next.js. We keep the same event-driven shape with an
 * in-process dispatcher: the handler runs asynchronously and every error is
 * swallowed and logged so the notification path can NEVER break the request
 * that emitted the event.
 */
export function emitPostTestCompleted(event: PostTestCompletedEvent): void {
    try {
        void handlePostTestCompleted(event).catch((error) => {
            logger.error('post-test-completed handler failed: %s', error);
        });
    } catch (error) {
        logger.error('failed to emit post-test-completed event: %s', error);
    }
}

import { prisma } from '@/lib/db';
import { ENV_VARS } from '@/lib/env-vars';
import type { PostTestCompletedEvent } from '@/lib/events';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:notifications:post-test-push');

/**
 * Handle a completed post-test by (eventually) pushing the user's balance score
 * to their registered Expo devices.
 *
 * Everything is wrapped in try/catch: this runs as a fire-and-forget side effect
 * of the rapid step test, so failures are logged and never propagated.
 */
export async function handlePostTestCompleted(event: PostTestCompletedEvent): Promise<void> {
    const { customerEmail, sessionToken } = event;

    try {
        // a) Ask the legacy STEDI API for the freshly-computed risk/balance score.
        const scoreUrl = new URL(`/riskscore/${encodeURIComponent(customerEmail)}`, `${ENV_VARS.STEDI_API_BASE_URL}/`);
        const response = await fetch(scoreUrl, {
            headers: { 'suresteps.session.token': sessionToken },
            cache: 'no-store',
        });

        if (!response.ok) {
            logger.error('could not fetch risk score for %s: upstream returned %s', customerEmail, response.status);
            return;
        }

        const { score } = (await response.json()) as { score: number };

        // b) Find the user's active push tokens.
        const tokens = await prisma.expoPushToken.findMany({
            where: { user: { email: customerEmail }, isActive: true },
        });

        // c) No devices registered is a normal state, not an error.
        if (tokens.length === 0) {
            logger.info('no active push tokens for %s; nothing to send', customerEmail);
            return;
        }

        // d) TODO(SCRUM-56): send the notification through the Expo push API.
        //    For now we only log what *would* be sent so the trigger can be
        //    validated end-to-end without the delivery integration.
        const message = `Your latest balance score is ${score}.`;
        for (const { token } of tokens) {
            logger.info('[SCRUM-56 pending] would send push notification -> token=%s score=%s message="%s"', token, score, message);
        }
    } catch (error) {
        logger.error('post-test push handling failed for %s: %s', customerEmail, error);
    }
}

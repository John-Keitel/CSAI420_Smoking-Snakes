import { type ExpoPushMessage } from 'expo-server-sdk';

import { prisma } from '@/lib/db';
import { ENV_VARS } from '@/lib/env-vars';
import type { PostTestCompletedEvent } from '@/lib/events';
import { getAppLogger } from '@/lib/logger';
import { sendPushNotifications } from '@/lib/notifications/expo-client';

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
            headers: {
                'x-suresteps-session-token': sessionToken,
                'suresteps.session.token': sessionToken,
            },
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

        // d) Build one message per device and push through the Expo SDK.
        const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
            to: token,
            title: 'Your balance score is ready',
            body: `Your latest balance score is ${score}.`,
            data: { score, type: 'post-test-score' },
            sound: 'default',
        }));

        const summary = await sendPushNotifications(messages);
        logger.info(
            'post-test push for %s -> sent=%s failed=%s deactivated=%s',
            customerEmail,
            summary.sent,
            summary.failed,
            summary.deactivated
        );
    } catch (error) {
        logger.error('post-test push handling failed for %s: %s', customerEmail, error);
    }
}

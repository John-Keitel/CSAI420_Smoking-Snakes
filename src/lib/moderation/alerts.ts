import { type ExpoPushMessage } from 'expo-server-sdk';

import type { FlaggedSession } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';
import { markFlaggedSessionAlerted } from '@/lib/moderation/repository';
import { sendPushNotifications } from '@/lib/notifications/expo-client';

const logger = getAppLogger('lib:moderation:alerts');

/**
 * Notify provider/developer devices about a new HIGH-risk flagged session.
 * Failures are logged and never thrown (coach chat must not fail on alert errors).
 */
export async function notifyModeratorsHighRisk(flagged: FlaggedSession): Promise<void> {
    try {
        if (flagged.severity !== 'HIGH') {
            return;
        }

        if (flagged.alertedAt) {
            return;
        }

        const tokens = await prisma.expoPushToken.findMany({
            where: {
                isActive: true,
                user: { type: { in: ['provider', 'developer'] } },
            },
        });

        if (tokens.length === 0) {
            logger.info('no active moderator push tokens for session %s', flagged.sessionId);
        } else {
            const messages: ExpoPushMessage[] = tokens.map(({ token }) => ({
                to: token,
                title: 'High-risk coach session flagged',
                body: `Session for ${flagged.customerEmail} needs moderation review.`,
                data: {
                    type: 'moderation-high-risk',
                    sessionId: flagged.sessionId,
                },
                sound: 'default',
            }));

            const summary = await sendPushNotifications(messages);
            logger.info(
                'moderation high-risk push for session %s -> sent=%s failed=%s deactivated=%s',
                flagged.sessionId,
                summary.sent,
                summary.failed,
                summary.deactivated
            );
        }

        await markFlaggedSessionAlerted(flagged.sessionId);
    } catch (error) {
        logger.error('moderation high-risk alert failed for session %s: %s', flagged.sessionId, error);
    }
}

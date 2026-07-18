import { Expo, type ExpoPushMessage } from 'expo-server-sdk';

import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:notifications:expo-client');

// Singleton Expo client — mirrors the prisma singleton in src/lib/db.ts so a
// single HTTP agent / connection pool is reused across hot reloads in dev.
const globalForExpo = globalThis as unknown as { expo: Expo };

export const expo = globalForExpo.expo || new Expo();

if (process.env.NODE_ENV !== 'production') globalForExpo.expo = expo;

export type PushSummary = {
    sent: number;
    failed: number;
    deactivated: number;
};

function tokenOf(message: ExpoPushMessage): string | undefined {
    const to = message.to;
    const token = Array.isArray(to) ? to[0] : to;
    return typeof token === 'string' ? token : undefined;
}

async function deactivateToken(token: string): Promise<boolean> {
    try {
        const result = await prisma.expoPushToken.updateMany({
            where: { token },
            data: { isActive: false },
        });

        if (result.count > 0) {
            logger.info('deactivated unregistered push token');
            return true;
        }

        return false;
    } catch (error) {
        logger.error('failed to deactivate push token: %s', error);
        return false;
    }
}

/**
 * Send Expo push notifications with defensive error handling:
 *  - drops messages whose recipient is not a valid Expo push token,
 *  - chunks messages to Expo's per-request batch limit,
 *  - logs every error ticket, and
 *  - deactivates tokens Expo reports as DeviceNotRegistered so we stop pushing
 *    to dead devices.
 *
 * Never throws: every failure is logged and folded into the returned summary.
 */
export async function sendPushNotifications(messages: ExpoPushMessage[]): Promise<PushSummary> {
    const summary: PushSummary = { sent: 0, failed: 0, deactivated: 0 };

    try {
        // a) Drop messages with an invalid Expo push token before sending.
        const valid = messages.filter((message) => {
            const token = tokenOf(message);
            if (!token || !Expo.isExpoPushToken(token)) {
                summary.failed++;
                logger.error('skipping message with invalid Expo push token');
                return false;
            }
            return true;
        });

        if (valid.length === 0) {
            return summary;
        }

        // b) Group into batches Expo will accept.
        const chunks = expo.chunkPushNotifications(valid);

        // c) Send each chunk. Tickets align 1:1 with the chunk's messages (we
        //    send single-recipient messages), so a failure maps back to a token.
        for (const chunk of chunks) {
            try {
                const tickets = await expo.sendPushNotificationsAsync(chunk);

                for (let i = 0; i < tickets.length; i++) {
                    const ticket = tickets[i];

                    if (ticket.status === 'ok') {
                        summary.sent++;
                        continue;
                    }

                    // d) Log every error ticket.
                    summary.failed++;
                    logger.error('push ticket error: %s (%s)', ticket.message, ticket.details?.error ?? 'unknown');

                    // e) Retire tokens Expo reports as no longer registered.
                    if (ticket.details?.error === 'DeviceNotRegistered') {
                        const token = ticket.details.expoPushToken ?? tokenOf(chunk[i]);
                        if (token) {
                            const deactivated = await deactivateToken(token);
                            if (deactivated) {
                                summary.deactivated++;
                            }
                    }
                }
            } catch (error) {
                // A whole chunk failed to send (e.g. network error). Count its
                // messages as failed and keep going with the remaining chunks.
                summary.failed += chunk.length;
                logger.error('failed to send push notification chunk: %s', error);
            }
        }
    } catch (error) {
        logger.error('sendPushNotifications failed: %s', error);
    }

    return summary;
}

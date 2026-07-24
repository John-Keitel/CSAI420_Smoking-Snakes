import type { ExpoPushMessage } from 'expo-server-sdk';

import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';
import { sendPushNotifications } from '@/lib/notifications/expo-client';

const logger = getAppLogger('lib:notifications:clinician-consent-request-push');

type ClinicianConsentRequested = {
    customerEmail: string;
    clinicianId: string;
};

export async function notifyClinicianConsentRequested(event: ClinicianConsentRequested): Promise<void> {
    const { customerEmail, clinicianId } = event;

    const tokens = await prisma.expoPushToken.findMany({
        where: {
            user: { email: customerEmail },
            isActive: true,
        },
    });

    if (tokens.length === 0) {
        logger.debug('no active expo tokens found for %s', customerEmail);
        return;
    }

    const messages: ExpoPushMessage[] = tokens.map((record) => ({
        to: record.token,
        title: 'Clinician consent request',
        body: `${clinicianId} requested access to your health coaching data.`,
        data: {
            type: 'clinician-consent-request',
            clinicianId,
        },
        sound: 'default',
        priority: 'high',
    }));

    const summary = await sendPushNotifications(messages);

    logger.info(
        'clinician consent push summary for %s: sent=%d failed=%d deactivated=%d',
        customerEmail,
        summary.sent,
        summary.failed,
        summary.deactivated
    );
}

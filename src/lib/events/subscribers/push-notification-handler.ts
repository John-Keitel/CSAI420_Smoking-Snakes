import { getAppLogger } from '@/lib/logger';

import { UserRegisteredViaChatEvent } from '../schemas/user-registered-event.schema';

const logger = getAppLogger('lib:events:subscribers:push-notification-handler');

export async function handlePushNotificationRegistration(event: UserRegisteredViaChatEvent): Promise<void> {
    // Simulated Lambda subscriber for Expo token linkage.
    logger.info('push-notification handler processed userId=%s method=%s', event.userId, event.method);
}

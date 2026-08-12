import { getAppLogger } from '@/lib/logger';

import { UserRegisteredViaChatEvent } from '../schemas/user-registered-event.schema';

const logger = getAppLogger('lib:events:subscribers:welcome-email-handler');

export async function handleWelcomeEmail(event: UserRegisteredViaChatEvent): Promise<void> {
    // Simulated Lambda subscriber for welcome email dispatch.
    logger.info('welcome-email handler processed userId=%s method=%s', event.userId, event.method);
}

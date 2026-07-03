import nodemailer from 'nodemailer';

import { ENV_VARS } from '@/lib/env-vars';
import { getAppLogger } from '@/lib/logger';
import { EmailParams } from '@/lib/mailer/types';

const logger = getAppLogger('lib:mailer');

function createTransport() {
    logger.debug('mailer create transport');
    return nodemailer.createTransport({
        host: ENV_VARS.MAILER_SMTP_HOST,
        port: ENV_VARS.MAILER_SMTP_PORT,
        secure: ENV_VARS.MAILER_SMTP_ENCRYPTION === 'ssl',
        auth: {
            user: ENV_VARS.MAILER_SMTP_USERNAME,
            pass: ENV_VARS.MAILER_SMTP_PASSWORD,
        },
        tls: {
            ciphers: 'SSLv3',
            rejectUnauthorized: ENV_VARS.APP_ENV !== 'local',
        },
    });
}

export async function sendEmail({ to, subject, html, text }: EmailParams) {
    try {
        logger.debug('sending email to: %s', to);
        const transporter = createTransport();

        return await transporter.sendMail({
            from: ENV_VARS.MAILER_FROM_EMAIL,
            to,
            subject,
            html,
            text,
        });
    } catch (error) {
        logger.error('SMTP Error: ', error);
        throw error;
    }
}

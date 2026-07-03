import winston from 'winston';

import { ENV_VARS } from '@/lib/env-vars';

import { Logger } from './types';

const { splat, printf, colorize } = winston.format;

const isProduction = ENV_VARS.NODE_ENV === 'production';

const myFormat = printf(({ level, message, timestamp, module }) => {
    // if at is defined, format the log message with the at value
    return isProduction ? `[${level}](${module}): ${message}` : `${timestamp} [${level}](${module}): ${message}`;
});

export function getAppLogger(module: String): Logger {
    const timestamp = winston.format.timestamp({
        format: 'YYYY-MM-DD HH:mm:ss.SSS',
    });

    const format = isProduction
        ? // remove colorize() for production
          winston.format.combine(splat(), timestamp, myFormat)
        : winston.format.combine(splat(), colorize(), timestamp, myFormat);

    return winston.createLogger({
        level: ENV_VARS.APP_LOG_LEVEL,
        format,
        defaultMeta: {
            module,
        },
        transports: [new winston.transports.Console()],
    });
}

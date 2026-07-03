import { loadEnvConfig } from '@next/env';
import { z } from 'zod';

loadEnvConfig(process.cwd());

const AppSchema = z.object({
    APP_ENV: z.enum(['production', 'local']).default('production'),
    APP_LOG_LEVEL: z.enum(['info', 'error', 'warn', 'debug']).default('info'),
});

const DatabaseSchema = z.object({
    DATABASE_URL: z.string().url(),
    DATABASE_DIRECT_URL: z.string().url(),
    DATABASE_DEBUG: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
});

const NodeEnvSchema = z.object({
    NODE_ENV: z.enum(['production', 'development']).default('production'),
});

const AuthSchema = z.object({
    AUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: z.string().url(),
    AUTH_TRUST_HOST: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    AUTH_DEBUG: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
});

const MailerSchema = z.object({
    MAILER_SMTP_HOST: z.string(),
    MAILER_SMTP_PORT: z.coerce.number(),
    MAILER_SMTP_USERNAME: z.string(),
    MAILER_SMTP_PASSWORD: z.string(),
    MAILER_SMTP_ENCRYPTION: z.enum(['tls', 'ssl']).default('tls'),
    MAILER_FROM_EMAIL: z.string().email(),
});

// https://zod.dev/?id=inferring-the-inferred-type
function validateEnvWithSchema<TSchema extends z.ZodTypeAny>(schema: TSchema, schemaName: string): z.infer<TSchema> {
    const result = schema.safeParse(process.env);

    if (!result.success) {
        console.error(`(${schemaName}) There is an error with the environment variables\n`);
        console.error(result.error.format());
        process.exit(1);
    }

    return result.data;
}

export const ENV_VARS = {
    ...validateEnvWithSchema(AppSchema, 'AppSchema'),
    ...validateEnvWithSchema(AuthSchema, 'AuthSchema'),
    ...validateEnvWithSchema(DatabaseSchema, 'DatabaseSchema'),
    ...validateEnvWithSchema(NodeEnvSchema, 'NodeEnvSchema'),
    ...validateEnvWithSchema(MailerSchema, 'MailerSchema'),
};

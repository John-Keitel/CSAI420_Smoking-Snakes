import nextEnv from '@next/env';
import { z } from 'zod';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

const AppSchema = z.object({
    APP_ENV: z.enum(['production', 'local']).default('production'),
    APP_LOG_LEVEL: z.enum(['info', 'error', 'warn', 'debug']).default('info'),
    STEDI_API_BASE_URL: z.url().default('https://dev.stedi.me'),
    STEDI_PROXY_TIMEOUT_MS: z.coerce.number().int().positive().default(8000),
    VOICE_LLM_ENABLED: z
        .enum(['true', 'false'])
        .default('false')
        .transform((value) => value === 'true'),
    OPENAI_API_KEY: z.string().optional(),
    OPENAI_MODEL: z.string().default('gpt-4o-mini'),
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
    NODE_ENV: z.enum(['production', 'development', 'test']).default('production'),
});

const AuthSchema = z
    .object({
        AUTH_SECRET: z.string().min(1).optional(),
        BETTER_AUTH_SECRET: z.string().min(1).optional(),
        NEXTAUTH_URL: z.string().url().optional(),
        BETTER_AUTH_URL: z.string().url().optional(),
        AUTH_TRUST_HOST: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
        AUTH_DEBUG: z
            .enum(['true', 'false'])
            .default('false')
            .transform((value) => value === 'true'),
    })
    .superRefine((value, ctx) => {
        if (!value.AUTH_SECRET && !value.BETTER_AUTH_SECRET) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'AUTH_SECRET or BETTER_AUTH_SECRET is required',
                path: ['AUTH_SECRET'],
            });
        }

        if (!value.NEXTAUTH_URL && !value.BETTER_AUTH_URL) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'NEXTAUTH_URL or BETTER_AUTH_URL is required',
                path: ['NEXTAUTH_URL'],
            });
        }
    });

const MailerSchema = z.object({
    MAILER_SMTP_HOST: z.string(),
    MAILER_SMTP_PORT: z.coerce.number(),
    MAILER_SMTP_USERNAME: z.string(),
    MAILER_SMTP_PASSWORD: z.string(),
    MAILER_SMTP_ENCRYPTION: z.enum(['tls', 'ssl']).default('tls'),
    MAILER_FROM_EMAIL: z.email(),
});

const AiSchema = z.object({
    OPENAI_API_KEY: z.preprocess((value) => {
        if (typeof value !== 'string') {
            return undefined;
        }

        const trimmed = value.trim();
        return trimmed.length > 0 ? trimmed : undefined;
    }, z.string().min(1).optional()),
});

// https://zod.dev/?id=inferring-the-inferred-type
function validateEnvWithSchema<TSchema extends z.ZodType>(schema: TSchema, schemaName: string): z.infer<TSchema> {
    const result = schema.safeParse(process.env);

    if (!result.success) {
        console.error(`(${schemaName}) There is an error with the environment variables\n`);
        console.error(z.prettifyError(result.error));
        process.exit(1);
    }

    return result.data;
}

const authVars = validateEnvWithSchema(AuthSchema, 'AuthSchema');

export const ENV_VARS = {
    ...validateEnvWithSchema(AppSchema, 'AppSchema'),
    ...authVars,
    AUTH_SECRET: authVars.AUTH_SECRET ?? authVars.BETTER_AUTH_SECRET!,
    BETTER_AUTH_SECRET: authVars.BETTER_AUTH_SECRET ?? authVars.AUTH_SECRET!,
    NEXTAUTH_URL: authVars.NEXTAUTH_URL ?? authVars.BETTER_AUTH_URL!,
    BETTER_AUTH_URL: authVars.BETTER_AUTH_URL ?? authVars.NEXTAUTH_URL!,
    ...validateEnvWithSchema(DatabaseSchema, 'DatabaseSchema'),
    ...validateEnvWithSchema(NodeEnvSchema, 'NodeEnvSchema'),
    ...validateEnvWithSchema(MailerSchema, 'MailerSchema'),
    ...validateEnvWithSchema(AiSchema, 'AiSchema'),
};

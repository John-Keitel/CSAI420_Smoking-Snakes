import { headers } from 'next/headers';

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { nextCookies } from 'better-auth/next-js';

import { prisma } from '@/lib/db';
import { ENV_VARS } from '@/lib/env-vars';

import { hashPassword, verifyPassword } from './password';

const trustedOrigins = Array.from(new Set([ENV_VARS.BETTER_AUTH_URL, ENV_VARS.NEXTAUTH_URL].map((value) => new URL(value).origin)));

export const auth = betterAuth({
    secret: ENV_VARS.BETTER_AUTH_SECRET,
    baseURL: ENV_VARS.BETTER_AUTH_URL,
    trustedOrigins,
    database: prismaAdapter(prisma, {
        provider: 'postgresql',
    }),
    advanced: {
        database: {
            generateId: false,
        },
    },
    emailAndPassword: {
        enabled: true,
        disableSignUp: true,
        password: {
            hash: hashPassword,
            verify: async ({ password, hash }) => verifyPassword(password, hash),
        },
    },
    user: {
        fields: {
            name: 'authName',
            emailVerified: 'authEmailVerified',
        },
    },
    session: {
        expiresIn: 60 * 60 * 24 * 30,
        updateAge: 60 * 60 * 24,
        cookieCache: {
            enabled: true,
            maxAge: 60 * 5,
        },
    },
    plugins: [nextCookies()],
});

export async function getAuthenticatedSession() {
    return auth.api.getSession({
        headers: await headers(),
    });
}

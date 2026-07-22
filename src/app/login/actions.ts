'use server';

import { redirect } from 'next/navigation';

import { authenticateWithStedi, StediLoginError } from '@/lib/auth/stedi-login';
import { syncCredentialAccount } from '@/lib/auth/credential-account';
import { createBetterAuthSession } from '@/lib/auth/session-cookie';
import { upsertStediSessionLink } from '@/lib/auth/stedi-session-link';
import { prisma } from '@/lib/db';
import { StediLoginSchema } from '@/lib/schemas';

export type LoginActionState = {
    fieldErrors?: {
        username?: string[];
        password?: string[];
    };
    formError?: string;
};

const defaultErrorMessage = 'Unable to sign in with this account.';

export async function loginAction(_: LoginActionState, formData: FormData): Promise<LoginActionState> {
    const parsed = await StediLoginSchema.safeParseAsync({
        username: formData.get('username'),
        password: formData.get('password'),
    });

    if (!parsed.success) {
        return {
            fieldErrors: parsed.error.flatten().fieldErrors,
        };
    }

    const { username, password } = parsed.data;

    try {
        const { token } = await authenticateWithStedi({ username, password });
        const user = await prisma.user.findUnique({
            where: { email: username },
            select: {
                id: true,
                email: true,
                password: true,
                firstName: true,
                lastName: true,
                emailVerified: true,
            },
        });

        if (!user) {
            return { formError: defaultErrorMessage };
        }

        await syncCredentialAccount(user);

        const { session } = await createBetterAuthSession(user.id);
        await upsertStediSessionLink(session.id, token, username);
    } catch (error) {
        if (error instanceof StediLoginError) {
            if (error.code === 'INVALID_INPUT') {
                return {
                    formError: defaultErrorMessage,
                };
            }

            if (error.code === 'INVALID_CREDENTIALS') {
                return {
                    formError: 'Invalid username or password.',
                };
            }

            return {
                formError: 'STEDI login is unavailable. Please try again.',
            };
        }

        return { formError: defaultErrorMessage };
    }

    redirect('/dashboard');
}
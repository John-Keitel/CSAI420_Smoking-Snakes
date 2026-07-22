import { cookies } from 'next/headers';

import { auth } from '@/lib/auth/better-auth';

async function signCookieValue(value: string, secret: string): Promise<string> {
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value));

    return Buffer.from(signature).toString('base64');
}

export async function createBetterAuthSession(userId: string) {
    const ctx = await auth.$context;
    const user = await ctx.internalAdapter.findUserById(userId);
    if (!user) {
        throw new Error(`User not found for auth session: ${userId}`);
    }

    const session = await ctx.internalAdapter.createSession(userId);
    const signedToken = `${session.token}.${await signCookieValue(session.token, ctx.secret)}`;
    const cookieStore = await cookies();
    const sameSite = ctx.authCookies.sessionToken.attributes.sameSite;

    cookieStore.set(ctx.authCookies.sessionToken.name, signedToken, {
        ...ctx.authCookies.sessionToken.attributes,
        sameSite: typeof sameSite === 'string' ? (sameSite.toLowerCase() as 'lax' | 'strict' | 'none') : sameSite,
        maxAge: ctx.sessionConfig.expiresIn,
    });

    return { session, user };
}

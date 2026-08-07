import { SignJWT } from 'jose';

import { ENV_VARS } from '@/lib/env-vars';

export * from './auth/index';

export type UserTokenPayload = {
    userId: string;
    email: string;
};

export async function signUserToken(payload: UserTokenPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(new TextEncoder().encode(ENV_VARS.AUTH_SECRET));
}

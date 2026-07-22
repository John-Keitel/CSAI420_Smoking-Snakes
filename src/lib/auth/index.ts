import { createHash } from 'crypto';
import { jwtVerify, SignJWT } from 'jose';
import { headers } from 'next/headers';

import type { Session, User } from '@/generated/prisma/client';
import { auth } from '@/lib/auth/better-auth';
import { prisma } from '@/lib/db';
import { ENV_VARS } from '@/lib/env-vars';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

export { auth, getAuthenticatedSession } from './better-auth';

export { hashPassword, verifyPassword } from '@/lib/auth/password';

const logger = getAppLogger('lib:auth');

export type Token = {
    token: string;
};

const sessionTimeToLiveInSeconds = 60 * 60 * 24 * 30; // 30 days in seconds

function getJwtSecret(): Uint8Array {
    return new TextEncoder().encode(ENV_VARS.AUTH_SECRET);
}

export async function createJwtToken(session: Session & { user: User }): Promise<Token> {
    logger.debug('Creating JWT token for session %s', session.id);

    const user = session.user;
    const token = await new SignJWT({
        version: 1,
        sub: user.id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        picture: user.image,
        id: user.id,
        sessionId: session.id,
        type: user.type,
    })
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setIssuer(ENV_VARS.NEXTAUTH_URL)
        .setExpirationTime(`${sessionTimeToLiveInSeconds}s`)
        .sign(getJwtSecret());

    return {
        token,
    };
}

async function getBearerSession(headerList: Headers): Promise<Session & { user: User }> {
    const authorization = headerList.get('authorization');
    if (!authorization) {
        throw new HttpException(401, 'Unauthenticated');
    }

    const [scheme, token] = authorization.split(' ');
    if (scheme !== 'Bearer' || !token) {
        throw new HttpException(401, 'Invalid authorization header');
    }

    const { payload } = await jwtVerify(token, getJwtSecret(), {
        issuer: ENV_VARS.NEXTAUTH_URL,
        algorithms: ['HS256'],
    });

    const sessionId = payload.sessionId;
    if (payload.version !== 1 || typeof sessionId !== 'string') {
        throw new HttpException(401, 'Invalid token');
    }

    logger.debug('looking for session %s', sessionId);
    const session = await prisma.session.findUnique({
        where: {
            id: sessionId,
        },
        include: {
            user: true,
        },
    });

    if (!session) {
        throw new HttpException(401, 'Session not found');
    }

    const expirationDate = new Date(session.updatedAt.getTime() + sessionTimeToLiveInSeconds * 1000);
    if (expirationDate < new Date()) {
        throw new HttpException(401, 'Session expired');
    }

    logger.debug('session user: %s (%s)', session.user.id, session.user.type);
    return session;
}

export async function getSession(): Promise<Session & { user: User }> {
    try {
        const headerList = await headers();

        try {
            const betterAuthSession = await auth.api.getSession({ headers: headerList });
            if (betterAuthSession) {
                const session = await prisma.session.findUnique({
                    where: { id: betterAuthSession.session.id },
                    include: { user: true },
                });

                if (!session) {
                    throw new HttpException(401, 'Session not found');
                }

                return session;
            }
        } catch (error) {
            logger.error('Better Auth session lookup failed: %s', error);
        }

        return await getBearerSession(headerList);
    } catch (e) {
        if (e instanceof HttpException) {
            throw e;
        }

        logger.error('cannot decode JWT token: %s', e);
        throw new HttpException(401, 'Invalid token');
    }
}

export function hashEmail(input: string): string {
    return createHash('md5').update(input).digest('hex');
}

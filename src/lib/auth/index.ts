// Based one: https://authjs.dev/getting-started/providers/credentials
import { decode, encode, JWT } from '@auth/core/jwt';
import { Session, User } from '@prisma/client';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';
import { headers } from 'next/headers';

import { prisma } from '@/lib/db';
import { ENV_VARS } from '@/lib/env-vars';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:auth');

export type Token = {
    token: string;
};

const sessionTimeToLiveInSeconds = 60 * 60 * 24 * 30; // 30 days in seconds

export async function createJwtToken(session: Session & { user: User }): Promise<Token> {
    logger.debug('Creating JWT token for session %s', session.id);

    // Get the user from the session
    const user = session.user;

    // Create a token payload similar to what Auth.js would create
    const tokenPayload: JWT = {
        // Standard JWT claims
        iat: Math.floor(Date.now() / 1000),
        sub: user.id, // Subject (user ID)
        exp: Math.floor(Date.now() / 1000) + sessionTimeToLiveInSeconds, // Expiration time
        jti: session.id, // Unique identifier for the token
        iss: ENV_VARS.NEXTAUTH_URL, // Issuer (your app URL)

        // User data
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        picture: user.image,

        // Additional Auth.js specific fields if needed
        id: user.id,
        sessionId: session.id,
        type: user.type,
    };

    // Encode the token using next-auth/jwt
    const token = await encode({
        token: tokenPayload,
        secret: ENV_VARS.AUTH_SECRET,
        salt: 'nextauth',
    });

    return {
        token,
    };
}

export async function getSession(): Promise<Session & { user: User }> {
    try {
        const headerList = await headers();

        const authorization = headerList.get('authorization');
        if (!authorization) {
            throw new HttpException(401, 'Unauthenticated');
        }

        const parts = authorization.split(' ');
        const token = parts[1];

        const jwt = await decode({
            token,
            secret: ENV_VARS.AUTH_SECRET,
            salt: 'nextauth',
        });

        if (!jwt) {
            throw new HttpException(401, 'Invalid token');
        }

        logger.debug('looking for session %s', jwt.sessionId);
        const session = await prisma.session.findUnique({
            where: {
                id: jwt.sessionId as string,
            },
            include: {
                user: true,
            },
        });

        if (!session) {
            throw new HttpException(401, 'Session not found');
        }

        // The session expires 30 days after the last update
        const expirationDate = new Date(session.updatedAt.getTime() + sessionTimeToLiveInSeconds * 1000);

        // Check if the session is expired
        if (expirationDate < new Date()) {
            throw new HttpException(401, 'Session expired');
        }

        logger.debug('session user: %s ($s)', session.user.id, session.user.type);
        return session;
    } catch (e) {
        if (e instanceof HttpException) {
            throw e;
        }

        logger.error('cannot decode JWT token: %s', e);
        throw new HttpException(401, 'Invalid token');
    }
}

const SALT_ROUNDS = 12;

export function hashEmail(input: string): string {
    return createHash('md5').update(input).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
}

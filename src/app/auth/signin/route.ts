import { NextRequest, NextResponse } from 'next/server';

import { createJwtToken, verifyPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { SignInSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:auth:signin');

export const POST = async (request: NextRequest) => {
    try {
        logger.debug('Authenticating user...');

        // Get a valid request body
        const body = await request.json();
        const result = await SignInSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        // The request data
        const { email, password } = result.data;

        // Find the user
        const user = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
                password: true,
            },
        });

        if (!user) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 400 });
        }

        const isValidPassword = await verifyPassword(password, user.password);

        if (!isValidPassword) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 400 });
        }

        // Let's create the session
        const session = await prisma.session.create({
            data: {
                userId: user.id,
            },
            include: {
                user: true,
            },
        });

        // Create the token
        const { token } = await createJwtToken(session);

        // Create JWT token
        return NextResponse.json(
            {
                userId: user.id,
                token,
            },
            { status: 200 }
        );
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
};

import { NextRequest, NextResponse } from 'next/server';

import { auth, verifyPassword } from '@/lib/auth';
import { syncCredentialAccount } from '@/lib/auth/credential-account';
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
                email: true,
                password: true,
                firstName: true,
                lastName: true,
                emailVerified: true,
            },
        });

        if (!user) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 400 });
        }

        const isValidPassword = await verifyPassword(password, user.password);

        if (!isValidPassword) {
            return NextResponse.json({ message: 'Invalid email or password' }, { status: 400 });
        }

        await syncCredentialAccount(user);

        const authResponse = await auth.handler(
            new Request(new URL('/api/auth/sign-in/email', request.url), {
                method: 'POST',
                headers: new Headers({
                    'content-type': 'application/json',
                    cookie: request.headers.get('cookie') ?? '',
                    origin: new URL(request.url).origin,
                }),
                body: JSON.stringify({
                    email,
                    password,
                }),
            })
        );

        if (!authResponse.ok) {
            const message = authResponse.status === 401 ? 'Invalid email or password' : 'Server Error';
            return NextResponse.json({ message }, { status: authResponse.status === 401 ? 400 : 500 });
        }

        const responseHeaders = new Headers();
        const setCookie = authResponse.headers.get('set-cookie');
        if (setCookie) {
            responseHeaders.set('set-cookie', setCookie);
        }

        return NextResponse.json({ userId: user.id }, { status: 200, headers: responseHeaders });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
};

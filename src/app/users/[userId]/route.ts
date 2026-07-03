import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { UpdateUserSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:users');

type RouteParams = {
    userId: string;
};

type PageProps = {
    params: Promise<RouteParams>;
};

export async function GET(_: NextRequest, { params }: PageProps) {
    try {
        const { userId } = await params;

        // check auth
        const { user: authUser } = await getSession();

        // Standard user can only access their own data
        if (authUser.type === 'standard' && authUser.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        logger.debug('getting user %s', userId);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            omit: {
                password: true,
            },
        });

        return NextResponse.json(user);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: PageProps) {
    try {
        const { userId } = await params;

        logger.debug('updating user %s', userId);

        // make sure the session is valid
        const { user: authUser } = await getSession();

        // start by validating the body
        const body = await request.json();
        const result = await UpdateUserSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        // Only developer can update other users
        if (authUser.type !== 'developer' && authUser.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const { firstName, lastName, displayName, dateOfBirth, timezone, locale } = result.data;

        const updatedUser = await prisma.user.update({
            where: { id: userId },
            data: {
                firstName,
                lastName,
                displayName,
                dateOfBirth,
                timezone,
                locale,
            },
            omit: {
                password: true,
            },
        });

        return NextResponse.json(updatedUser);
    } catch (e) {
        logger.error('request failed: %s', e);
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function DELETE(_: NextRequest, { params }: PageProps) {
    try {
        const { userId } = await params;

        // check auth
        const { user: authUser } = await getSession();

        // Only developer can delete other users
        if (authUser.type !== 'developer' && authUser.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        logger.debug('deleting user %s', userId);
        await prisma.user.delete({
            where: { id: userId },
        });

        return new NextResponse(null, { status: 204 });
    } catch (e) {
        logger.error('request failed: %s', e);
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

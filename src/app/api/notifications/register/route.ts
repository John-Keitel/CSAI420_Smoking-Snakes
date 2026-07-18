import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { RegisterPushTokenSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:notifications:register');

function validateSession(request: NextRequest) {
    const sessionCheck = validateSureStepsSession(request);
    if (!sessionCheck.ok) throw new HttpException(401, sessionCheck.reason ?? 'Unauthorized');
}

function errorResponse(error: unknown) {
    if (error instanceof HttpException) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    logger.error('request failed: %s', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
}

// Register (or refresh) an Expo push token for a user.
export async function POST(request: NextRequest) {
    try {
        validateSession(request);

        const body = await request.json();

        const result = RegisterPushTokenSchema.safeParse(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        const { token, userId, deviceName, platform } = result.data;

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new HttpException(404, 'User not found');

        const lastUsedAt = new Date();
        const pushToken = await prisma.expoPushToken.upsert({
            where: { token },
            create: { token, userId, deviceName, platform, isActive: true, lastUsedAt },
            update: { userId, deviceName, platform, isActive: true, lastUsedAt },
        });

        logger.info('registered expo push token id %s for user %s', pushToken.id, userId);

        return NextResponse.json(
            {
                id: pushToken.id,
                token: pushToken.token,
                userId: pushToken.userId,
                platform: pushToken.platform,
                isActive: pushToken.isActive,
            },
            { status: 201 }
        );
    } catch (error) {
        return errorResponse(error);
    }
}

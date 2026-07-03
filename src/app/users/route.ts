import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:users');

export async function GET() {
    try {
        // check auth
        const { user: authUser } = await getSession();

        const where =
            authUser.type === 'standard'
                ? {
                      id: authUser.id,
                  }
                : undefined;

        logger.debug('getting users...');
        const result = await prisma.user.findMany({ where });

        return NextResponse.json(result);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

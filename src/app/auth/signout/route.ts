import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:auth:signout');

export const DELETE = async () => {
    try {
        logger.debug('signing out...');
        const session = await getSession();

        // Delete session
        logger.debug('deleting session %s', session.id);
        await prisma.session.delete({
            where: {
                id: session.id,
            },
        });

        return new NextResponse(null, { status: 204 });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
};

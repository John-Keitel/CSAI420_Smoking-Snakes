import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth, getSession } from '@/lib/auth';
import { deleteStediSessionLink } from '@/lib/auth/stedi-session-link';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:auth:signout');

export const DELETE = async () => {
    try {
        logger.debug('signing out...');

        const headerList = await headers();
        const betterAuthSession = await auth.api.getSession({ headers: headerList });

        if (betterAuthSession) {
            await deleteStediSessionLink(betterAuthSession.session.id);

            const signOutResponse = await auth.api.signOut({
                headers: headerList,
                asResponse: true,
            });

            return new NextResponse(null, { status: 204, headers: signOutResponse.headers });
        }

        const session = await getSession();
        await deleteStediSessionLink(session.id);

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

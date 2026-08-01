import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:user:[userId]');

/**
 * Public test-data cleanup for the Week 5 suite: `DELETE /user/:id` removes a
 * user created through chat-assisted registration so repeat runs do not collide
 * on unique emails. Same 404 pattern as `DELETE /escalation/[escalationId]`.
 */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const { userId } = await params;

        const deleted = await prisma.user.deleteMany({ where: { id: userId } });

        if (deleted.count === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        logger.error('user delete failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

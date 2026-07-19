import { NextResponse } from 'next/server';

import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { listOpenFlaggedSessions, requireModerator } from '@/lib/moderation';

const logger = getAppLogger('api:moderation:flagged');

export async function GET() {
    try {
        await requireModerator();
        const flagged = await listOpenFlaggedSessions();
        return NextResponse.json(flagged);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }
        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

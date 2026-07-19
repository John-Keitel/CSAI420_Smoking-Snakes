import { NextRequest, NextResponse } from 'next/server';

import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { requireModerator, resolveFlaggedSession } from '@/lib/moderation';
import { ModerationResolveSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:moderation:resolve');

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
    try {
        const { user } = await requireModerator();
        const { sessionId } = await context.params;

        if (!sessionId) {
            throw new HttpException(400, 'sessionId is required');
        }

        const body = await request.json().catch(() => ({}));
        const parsed = ModerationResolveSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 400 });
        }

        const flagged = await resolveFlaggedSession({
            sessionId,
            resolvedByUserId: user.id,
            resolutionNotes: parsed.data.resolutionNotes,
        });

        return NextResponse.json(flagged);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }
        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

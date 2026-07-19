import { NextRequest, NextResponse } from 'next/server';

import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { requireModerator, reviewFlaggedSession } from '@/lib/moderation';
import { ModerationReviewSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:moderation:review');

export async function POST(request: NextRequest) {
    try {
        const { user } = await requireModerator();
        const body = await request.json().catch(() => ({}));
        const parsed = ModerationReviewSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 400 });
        }

        const flagged = await reviewFlaggedSession({
            sessionId: parsed.data.sessionId,
            humanOverride: parsed.data.humanOverride,
            reviewerNotes: parsed.data.reviewerNotes,
            reviewedByUserId: user.id,
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

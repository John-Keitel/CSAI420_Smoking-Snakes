import { NextRequest, NextResponse } from 'next/server';

import { ContinueChatSessionSchema, continueOnboardingChatSession } from '@/lib/chat-continuation';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { formatZodErrorsAsList } from '@/lib/validation';

const logger = getAppLogger('api:chat:continue-session');

// No auth: this is an anonymous pre-registration chat session, identified only by
// chatSessionId. See src/lib/chat-continuation/session.ts for how it's driven — it's the
// onboarding LangGraph from Epic 13 (src/lib/onboarding/graph.ts), not a separate ad-hoc
// conversation engine. That module's docblock also carries the MemorySaver production-readiness
// gap; it applies to this route unchanged.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = ContinueChatSessionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ errors: formatZodErrorsAsList(parsed.error) }, { status: 400 });
        }

        const result = await continueOnboardingChatSession(parsed.data.chatSessionId, parsed.data.message);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        logger.error('request failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

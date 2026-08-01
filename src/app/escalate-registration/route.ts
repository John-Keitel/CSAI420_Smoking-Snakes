import { NextRequest, NextResponse } from 'next/server';

import { createRegistrationEscalation, ESTIMATED_RESPONSE_TIME_BY_PRIORITY } from '@/lib/escalation';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { EscalateRegistrationSchema } from '@/lib/schemas';
import { formatZodErrorsAsList } from '@/lib/validation';

const logger = getAppLogger('api:escalate-registration');

// Unlike /escalate-question, this endpoint has no suresteps.session.token check: it's reached by
// a prospective user who hasn't finished registering yet, so there is no session to authenticate.
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = EscalateRegistrationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ errors: formatZodErrorsAsList(parsed.error) }, { status: 400 });
        }

        const escalation = await createRegistrationEscalation({
            phoneNumber: parsed.data.phoneNumber,
            issueType: parsed.data.issueType,
            aiResponse: parsed.data.aiResponse,
            responsePreference: parsed.data.responsePreference,
            registrationData: parsed.data.registrationData,
            conversationContext: parsed.data.conversationContext,
        });

        return NextResponse.json(
            {
                status: 'escalated',
                escalationId: escalation.escalationId,
                estimatedResponseTime: ESTIMATED_RESPONSE_TIME_BY_PRIORITY[escalation.priority],
                message: 'Your registration issue has been forwarded to our support team.',
            },
            { status: 200 }
        );
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        logger.error('request failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

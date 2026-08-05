import { NextRequest, NextResponse } from 'next/server';

import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { handleRegistrationEscalation } from '@/lib/registration-escalation';
import { RegistrationEscalationSchema } from '@/lib/schemas/registration-escalation.schema';
import { flattenZodErrors } from '@/lib/validation/week5-errors';

const logger = getAppLogger('api:escalate-registration');

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));

        const parsed = RegistrationEscalationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ errors: flattenZodErrors(parsed.error).errors }, { status: 400 });
        }

        const { escalation, estimatedResponseTime } = await handleRegistrationEscalation(parsed.data);

        return NextResponse.json(
            {
                status: 'escalated',
                escalationId: escalation.escalationId,
                estimatedResponseTime,
                message: 'Your registration issue has been forwarded to our support team',
            },
            { status: 200 }
        );
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        logger.error('registration escalation failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

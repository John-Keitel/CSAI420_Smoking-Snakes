import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { handleEscalation } from '@/lib/escalation';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { EscalateQuestionSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:escalate-question');

function validateSession(request: NextRequest) {
    const sessionCheck = validateSureStepsSession(request);
    if (!sessionCheck.ok) throw new HttpException(401, sessionCheck.reason ?? 'Unauthorized');

    return sessionCheck;
}

function errorResponse(error: unknown) {
    if (error instanceof HttpException) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    logger.error('request failed: %s', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
}

/**
 * Escalate a Mobility Coach conversation the AI could not safely answer to a
 * human coach.
 */
export async function POST(request: NextRequest) {
    try {
        validateSession(request);

        // Malformed and empty bodies both land here and fail schema validation as
        // a 400, rather than surfacing as an unhandled parse error.
        const body = await request.json().catch(() => ({}));

        const parsed = EscalateQuestionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 400 });
        }

        const { escalation, estimatedResponseTime } = await handleEscalation(parsed.data);

        return NextResponse.json({
            status: 'escalated',
            escalationId: escalation.escalationId,
            estimatedResponseTime,
            message: 'Your question has been forwarded to a healthcare coach',
        });
    } catch (error) {
        return errorResponse(error);
    }
}

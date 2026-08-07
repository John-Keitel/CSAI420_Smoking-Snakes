import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { deleteEscalationByEscalationId, findEscalationByEscalationId } from '@/lib/escalation';
import { toEscalationStatusResponse } from '@/lib/escalation/serializer';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:escalation');

type RouteContext = {
    params: Promise<{ escalationId: string }>;
};

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

/** Escalation status for the chatbot to poll while the patient waits. */
export async function GET(request: NextRequest, context: RouteContext) {
    try {
        // Authorization is resolved before existence so an unauthenticated caller
        // cannot probe which escalation identifiers are real.
        validateSession(request);

        const { escalationId } = await context.params;
        if (!escalationId) throw new HttpException(400, 'escalationId is required');

        const escalation = await findEscalationByEscalationId(escalationId);
        if (!escalation) throw new HttpException(404, 'Escalation not found');

        return NextResponse.json(toEscalationStatusResponse(escalation));
    } catch (error) {
        return errorResponse(error);
    }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
    try {
        validateSession(request);

        const { escalationId } = await context.params;
        if (!escalationId) throw new HttpException(400, 'escalationId is required');

        const deleted = await deleteEscalationByEscalationId(escalationId);
        if (!deleted) throw new HttpException(404, 'Escalation not found');

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        return errorResponse(error);
    }
}

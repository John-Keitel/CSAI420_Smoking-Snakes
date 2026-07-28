import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { deleteEscalationByEscalationId, getEscalationByEscalationId } from '@/lib/escalation';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:escalation');

type RouteParams = {
    escalationId: string;
};

type PageProps = {
    params: Promise<RouteParams>;
};

export async function GET(request: NextRequest, { params }: PageProps) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });
        }

        const { escalationId } = await params;
        const escalation = await getEscalationByEscalationId(escalationId);

        return NextResponse.json(
            {
                escalationId: escalation.escalationId,
                status: escalation.status,
                originalQuestion: escalation.originalQuestion,
                phoneNumber: escalation.phoneNumber,
                responsePreference: escalation.responsePreference,
                escalationTimestamp: escalation.escalationTimestamp,
                priority: escalation.priority,
                category: escalation.category,
                aiResponse: escalation.aiResponse,
            },
            { status: 200 }
        );
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }
        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest, { params }: PageProps) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });
        }

        const { escalationId } = await params;
        await deleteEscalationByEscalationId(escalationId);

        return new NextResponse(null, { status: 204 });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }
        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

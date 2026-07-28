import { NextRequest, NextResponse } from 'next/server';

import type { EscalationPriority } from '@/generated/prisma/client';
import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { createEscalation } from '@/lib/escalation';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { EscalateQuestionSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:escalate-question');

const ESTIMATED_RESPONSE_TIME: Record<EscalationPriority, string> = {
    high: '15-30 minutes',
    medium: '1-2 hours',
    low: '4-24 hours',
};

export async function POST(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const parsed = EscalateQuestionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 400 });
        }

        const escalation = await createEscalation({
            userId: parsed.data.userId,
            phoneNumber: parsed.data.phoneNumber,
            question: parsed.data.question,
            aiResponse: parsed.data.aiResponse,
            responsePreference: parsed.data.responsePreference,
            waitingForResponse: parsed.data.waitingForResponse,
            questionTimestamp: parsed.data.timestamp,
        });

        return NextResponse.json(
            {
                status: 'escalated',
                escalationId: escalation.escalationId,
                estimatedResponseTime: ESTIMATED_RESPONSE_TIME[escalation.priority],
                message: 'Your question has been forwarded to a healthcare coach and a response is on the way.',
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

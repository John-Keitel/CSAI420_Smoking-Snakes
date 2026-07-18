import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { SureStepsSessionSuccess, validateSureStepsSession } from '@/lib/auth/suresteps';
import {
    findOrCreateSession,
    getLatestSessionMessages,
    saveAiResponse,
    saveUserMessage,
} from '@/lib/chat-history-repository';
import { generateCoachAiResponse } from '@/lib/coach-ai';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:coach:chat');

const CoachChatInputSchema = z.object({
    currentBalanceScore: z.number(),
    previousBalanceScore: z.number().nullable().optional(),
    patientContext: z.string().optional(),
});

function isPatientSession(session: SureStepsSessionSuccess): boolean {
    return session.user.type === undefined || session.user.type === 'patient' || session.user.type === 'standard';
}

function resolveCustomerEmailFromSession(
    session: SureStepsSessionSuccess
): { ok: true; customerEmail: string } | { ok: false; status: number; message: string } {
    if (isPatientSession(session)) {
        const sessionEmail = session.user.email;

        if (!sessionEmail) {
            return { ok: false, status: 401, message: 'Session user email not available' };
        }

        return { ok: true, customerEmail: sessionEmail };
    }

    if (!session.user.email) {
        return { ok: false, status: 401, message: 'Session user email not available' };
    }

    return { ok: true, customerEmail: session.user.email };
}

function unauthorized(reason?: string) {
    return NextResponse.json({ error: reason ?? 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return unauthorized(sessionCheck.reason);
        }

        const customerResolution = resolveCustomerEmailFromSession(sessionCheck);
        if (!customerResolution.ok) {
            return NextResponse.json({ error: customerResolution.message }, { status: customerResolution.status });
        }

        const messages = await getLatestSessionMessages(customerResolution.customerEmail);
        return NextResponse.json(messages, { status: 200 });
    } catch (error) {
        logger.error('request failed: %s', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return unauthorized(sessionCheck.reason);
        }

        const body = await request.json().catch(() => ({}));
        const parsed = CoachChatInputSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error: 'Invalid request body',
                    details: z.treeifyError(parsed.error),
                },
                { status: 400 }
            );
        }

        const customerResolution = resolveCustomerEmailFromSession(sessionCheck);
        if (!customerResolution.ok) {
            return NextResponse.json({ error: customerResolution.message }, { status: customerResolution.status });
        }

        const sessionId = await findOrCreateSession(customerResolution.customerEmail);

        await saveUserMessage(sessionId, parsed.data.patientContext || 'Iniciando consulta de mobilidade');

        const response = await generateCoachAiResponse({
            ...parsed.data,
            customerEmail: customerResolution.customerEmail,
        });

        await saveAiResponse(sessionId, response.responseText, {
            escalate: response.escalate,
            clinicianTokenActive: response.deepBehavioralLogExportRecommendation === 'allow',
        });

        return NextResponse.json(response, { status: 200 });
    } catch (error) {
        logger.error('request failed: %s', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

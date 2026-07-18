import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
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
    customerEmail: z.email(),
    currentBalanceScore: z.number(),
    previousBalanceScore: z.number().nullable().optional(),
    patientContext: z.string().optional(),
});

const CoachChatHistoryQuerySchema = z.object({
    customerEmail: z.email(),
});

function unauthorized(reason?: string) {
    return NextResponse.json({ error: reason ?? 'Unauthorized' }, { status: 401 });
}

export async function GET(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return unauthorized(sessionCheck.reason);
        }

        const parsedQuery = CoachChatHistoryQuerySchema.safeParse({
            customerEmail: request.nextUrl.searchParams.get('customerEmail'),
        });

        if (!parsedQuery.success) {
            return NextResponse.json(
                {
                    error: 'Invalid query parameter',
                    details: z.treeifyError(parsedQuery.error),
                },
                { status: 400 }
            );
        }

        const messages = await getLatestSessionMessages(parsedQuery.data.customerEmail);
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

        const sessionId = await findOrCreateSession(parsed.data.customerEmail);

        await saveUserMessage(sessionId, parsed.data.patientContext || 'Iniciando consulta de mobilidade');

        const response = await generateCoachAiResponse(parsed.data);

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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { HttpException } from '@/lib/http';
import { BALANCE_TEST_SCRIPT, buildStepTwiml, convertScriptToVoiceSteps, createInitialExerciseState } from '@/lib/ivr-exercise-flow';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:voice:exercise:start');

const StartExerciseSchema = z.object({
    script: z.array(z.string().min(1)).min(1).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = StartExerciseSchema.safeParse(body);

        if (!parsed.success) {
            throw new HttpException(400, 'Invalid request body for IVR exercise start.');
        }

        const script = parsed.data.script ?? BALANCE_TEST_SCRIPT;
        const steps = convertScriptToVoiceSteps(script);
        const state = createInitialExerciseState(steps);
        const currentStep = steps[state.currentStepIndex];

        return NextResponse.json({
            sessionId: crypto.randomUUID(),
            state,
            step: currentStep,
            twiml: currentStep ? buildStepTwiml(currentStep) : '<Response><Say>No instructions available.</Say></Response>',
            totalSteps: steps.length,
        });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

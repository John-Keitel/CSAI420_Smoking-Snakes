import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import {
    ExerciseAction,
    BALANCE_TEST_SCRIPT,
    applyExerciseAction,
    buildStepTwiml,
    convertScriptToVoiceSteps,
    IvrExerciseState,
} from '@/lib/ivr-exercise-flow';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:voice:exercise:interaction');

const ExerciseStateSchema = z.object({
    currentStepIndex: z.number().int().nonnegative(),
    paused: z.boolean(),
    awaitingConfirmation: z.boolean(),
    completed: z.boolean(),
});

const InteractionSchema = z.object({
    action: z.enum(['next', 'repeat', 'pause', 'resume', 'confirm']),
    state: ExerciseStateSchema,
    script: z.array(z.string().min(1)).min(1).optional(),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = InteractionSchema.safeParse(body);

        if (!parsed.success) {
            throw new HttpException(400, 'Invalid request body for IVR exercise interaction.');
        }

        const steps = convertScriptToVoiceSteps(parsed.data.script ?? BALANCE_TEST_SCRIPT);
        const state = parsed.data.state as IvrExerciseState;
        const action = parsed.data.action as ExerciseAction;
        const result = applyExerciseAction(action, state, steps);
        const currentStep = result.state.completed ? null : steps[result.state.currentStepIndex] ?? null;

        return NextResponse.json(
            {
                ok: result.type === 'ok',
                message: result.message,
                state: result.state,
                step: currentStep,
                twiml: currentStep ? buildStepTwiml(currentStep) : '<Response><Say>Exercise complete.</Say></Response>',
            },
            { status: result.type === 'ok' ? 200 : 409 }
        );
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
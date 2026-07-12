export type VoiceTransport = 'bluetooth' | 'wifi';

export type ExerciseAction = 'next' | 'repeat' | 'pause' | 'resume' | 'confirm';

export type ExerciseActionResultType = 'ok' | 'blocked';

export type IvrExerciseStep = {
    id: string;
    prompt: string;
    pauseSeconds: number;
    requiresConfirmation: boolean;
};

export type IvrExerciseState = {
    currentStepIndex: number;
    paused: boolean;
    awaitingConfirmation: boolean;
    completed: boolean;
};

export type ExerciseActionResult = {
    type: ExerciseActionResultType;
    message: string;
    state: IvrExerciseState;
};

const DEFAULT_STEP_PAUSE_SECONDS = 2;

/**
 * Task 6: Converted balance test script into sequential voice-ready instructions.
 */
export const BALANCE_TEST_SCRIPT: readonly string[] = [
    'Please stand upright with your feet shoulder-width apart.',
    'When you are ready, press any key to begin your balance test.',
    'Keep your body still and breathe normally while we collect sensor data.',
    'If you need to pause, stay safe and use the keypad command to pause the test.',
    'The exercise is complete. Please stay on the line while we process your score.',
];

function escapeXml(value: string): string {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}

export function convertScriptToVoiceSteps(script: readonly string[]): IvrExerciseStep[] {
    return script.map((prompt, index) => ({
        id: `step-${index + 1}`,
        prompt,
        pauseSeconds: index === 2 ? 4 : DEFAULT_STEP_PAUSE_SECONDS,
        requiresConfirmation: index < script.length - 1,
    }));
}

export function createInitialExerciseState(steps: readonly IvrExerciseStep[]): IvrExerciseState {
    const firstStep = steps[0];

    return {
        currentStepIndex: 0,
        paused: false,
        awaitingConfirmation: firstStep?.requiresConfirmation ?? false,
        completed: steps.length === 0,
    };
}

export function buildStepTwiml(step: IvrExerciseStep): string {
    const stepPrompt = escapeXml(step.prompt);
    const confirmationPrompt = step.requiresConfirmation
        ? '<Say>Press 1 to confirm and continue when you are ready.</Say>'
        : '<Say>Thank you. Processing your result now.</Say>';

    return [
        '<Response>',
        `<Say>${stepPrompt}</Say>`,
        `<Pause length="${Math.max(1, Math.floor(step.pauseSeconds))}"/>`,
        confirmationPrompt,
        '</Response>',
    ].join('');
}

export function applyExerciseAction(
    action: ExerciseAction,
    currentState: IvrExerciseState,
    steps: readonly IvrExerciseStep[]
): ExerciseActionResult {
    const state: IvrExerciseState = { ...currentState };

    if (state.completed) {
        return {
            type: 'blocked',
            message: 'Exercise already completed.',
            state,
        };
    }

    if (action === 'pause') {
        state.paused = true;
        return { type: 'ok', message: 'Exercise paused. Press resume when you are ready.', state };
    }

    if (action === 'resume') {
        state.paused = false;
        return { type: 'ok', message: 'Exercise resumed.', state };
    }

    if (action === 'repeat') {
        return { type: 'ok', message: 'Repeating the current instruction.', state };
    }

    if (state.paused) {
        return {
            type: 'blocked',
            message: 'Exercise is paused. Resume before continuing.',
            state,
        };
    }

    if (action === 'confirm') {
        state.awaitingConfirmation = false;
        return { type: 'ok', message: 'Step confirmed. Press next to continue.', state };
    }

    if (state.awaitingConfirmation) {
        return {
            type: 'blocked',
            message: 'Please confirm the current step before moving to the next one.',
            state,
        };
    }

    const nextIndex = state.currentStepIndex + 1;
    if (nextIndex >= steps.length) {
        state.completed = true;
        return { type: 'ok', message: 'Exercise completed.', state };
    }

    const nextStep = steps[nextIndex];
    state.currentStepIndex = nextIndex;
    state.awaitingConfirmation = nextStep.requiresConfirmation;

    return {
        type: 'ok',
        message: `Advanced to ${nextStep.id}.`,
        state,
    };
}

export function hasRecentSensorData(payload: unknown): boolean {
    if (Array.isArray(payload)) {
        return payload.length > 0;
    }

    if (!payload || typeof payload !== 'object') {
        return false;
    }

    const record = payload as Record<string, unknown>;
    if (Array.isArray(record.updates)) {
        return record.updates.length > 0;
    }

    if (Array.isArray(record.data)) {
        return record.data.length > 0;
    }

    return false;
}
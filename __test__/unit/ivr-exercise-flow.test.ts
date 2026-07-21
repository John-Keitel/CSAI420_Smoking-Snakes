import { describe, expect, it } from 'vitest';

import {
    BALANCE_TEST_SCRIPT,
    applyExerciseAction,
    buildStepTwiml,
    convertScriptToVoiceSteps,
    createInitialExerciseState,
    hasRecentSensorData,
} from '@/lib/ivr-exercise-flow';

describe('convertScriptToVoiceSteps', () => {
    it('converts balance script into sequential IVR steps', () => {
        const steps = convertScriptToVoiceSteps(BALANCE_TEST_SCRIPT);

        expect(steps).toHaveLength(BALANCE_TEST_SCRIPT.length);
        expect(steps[0].id).toBe('step-1');
        expect(steps[1].id).toBe('step-2');
        expect(steps[0].prompt).toBe(BALANCE_TEST_SCRIPT[0]);
        expect(steps[0].requiresConfirmation).toBe(true);
        expect(steps.at(-1)?.requiresConfirmation).toBe(false);
    });

    it('builds TwiML with pacing and confirmation guidance', () => {
        const [step] = convertScriptToVoiceSteps(BALANCE_TEST_SCRIPT);
        const twiml = buildStepTwiml(step);

        expect(twiml).toContain('<Response>');
        expect(twiml).toContain('<Say>');
        expect(twiml).toContain('<Pause length="2"/>');
        expect(twiml).toContain('Press 1 to confirm and continue');
    });
});

describe('applyExerciseAction', () => {
    it('requires confirmation before moving to the next step', () => {
        const steps = convertScriptToVoiceSteps(BALANCE_TEST_SCRIPT);
        const initialState = createInitialExerciseState(steps);

        const blocked = applyExerciseAction('next', initialState, steps);
        expect(blocked.type).toBe('blocked');
        expect(blocked.message).toMatch(/confirm/i);

        const confirmed = applyExerciseAction('confirm', blocked.state, steps);
        expect(confirmed.type).toBe('ok');
        expect(confirmed.state.awaitingConfirmation).toBe(false);

        const moved = applyExerciseAction('next', confirmed.state, steps);
        expect(moved.type).toBe('ok');
        expect(moved.state.currentStepIndex).toBe(1);
    });

    it('handles pause and resume progression control', () => {
        const steps = convertScriptToVoiceSteps(BALANCE_TEST_SCRIPT);
        const initialState = createInitialExerciseState(steps);

        const paused = applyExerciseAction('pause', initialState, steps);
        expect(paused.state.paused).toBe(true);

        const blockedWhilePaused = applyExerciseAction('next', paused.state, steps);
        expect(blockedWhilePaused.type).toBe('blocked');
        expect(blockedWhilePaused.message).toMatch(/paused/i);

        const resumed = applyExerciseAction('resume', blockedWhilePaused.state, steps);
        expect(resumed.state.paused).toBe(false);
    });
});

describe('hasRecentSensorData', () => {
    it('detects sensor payload arrays or update wrappers', () => {
        expect(hasRecentSensorData([{ id: 1 }])).toBe(true);
        expect(hasRecentSensorData({ updates: [{ id: 1 }] })).toBe(true);
        expect(hasRecentSensorData({ data: [{ id: 1 }] })).toBe(true);
        expect(hasRecentSensorData([])).toBe(false);
        expect(hasRecentSensorData({ updates: [] })).toBe(false);
    });
});

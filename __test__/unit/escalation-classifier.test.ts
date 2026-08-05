import { describe, expect, it } from 'vitest';

import { classifyEscalation } from '@/lib/escalation/classifier';

describe('classifyEscalation', () => {
    it('routes clinical questions to the high-priority medical lane', () => {
        expect(
            classifyEscalation(
                "I'm having chest pain after my balance test, should I be worried?",
                'I cannot provide medical advice about chest pain. Let me connect you with a healthcare professional.'
            )
        ).toEqual({ priority: 'HIGH', category: 'MEDICAL' });
    });

    it('routes app defects to the technical lane', () => {
        expect(
            classifyEscalation(
                'The app keeps crashing when I try to view my balance scores',
                "I'm unable to diagnose technical issues with the app. Let me connect you with our technical support team."
            )
        ).toEqual({ priority: 'MEDIUM', category: 'TECHNICAL' });
    });

    it('does not read balance-test vocabulary in an app defect as clinical', () => {
        // Regression: "balance", "score" and "test" are product nouns, not symptoms.
        // Treating them as clinical would misroute every app complaint to a coach.
        const { category } = classifyEscalation('The app keeps crashing when I try to view my balance scores', '');
        expect(category).toBe('TECHNICAL');
    });

    it('does not treat the shared hand-off phrasing as a technical signal', () => {
        // Every category's AI reply ends with "Let me connect you with ...", so
        // "connect" and "diagnose" must never classify on their own.
        const { category } = classifyEscalation(
            'I fell during my last exercise and my knee is swollen',
            'Let me connect you with a coach who can diagnose this properly.'
        );
        expect(category).toBe('MEDICAL');
    });

    it('falls back to the general lane when nothing matches', () => {
        expect(
            classifyEscalation(
                'Can I share my test results with multiple people?',
                'This involves privacy settings that require human assistance.'
            )
        ).toEqual({ priority: 'MEDIUM', category: 'GENERAL' });
    });

    it('matches on whole words only', () => {
        // "app" must not fire on "happened"; "fall" must not fire on "fallback".
        const { category } = classifyEscalation('What happened to my weekly summary?', 'A coach can explain that.');
        expect(category).toBe('GENERAL');
    });
});

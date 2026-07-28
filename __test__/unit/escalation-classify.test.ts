import { describe, expect, it } from 'vitest';

import { classifyEscalation } from '@/lib/escalation/classify';

describe('classifyEscalation', () => {
    it('classifies medical language as high priority', () => {
        const result = classifyEscalation(
            "I'm having chest pain after my balance test, should I be worried?",
            'I cannot provide medical advice about chest pain.'
        );

        expect(result).toEqual({ priority: 'high', category: 'medical' });
    });

    it('classifies technical language as medium priority', () => {
        const result = classifyEscalation(
            'The app keeps crashing when I try to view my balance scores',
            "I'm unable to diagnose technical issues with the app."
        );

        expect(result).toEqual({ priority: 'medium', category: 'technical' });
    });

    it('falls back to general/medium when no keywords match', () => {
        const result = classifyEscalation(
            'Can I share my test results with multiple doctors?',
            'This involves privacy settings that require human assistance.'
        );

        expect(result).toEqual({ priority: 'medium', category: 'general' });
    });

    it('prefers medical over technical when both appear', () => {
        const result = classifyEscalation('The app crashed and now my chest hurts', 'unclear');

        expect(result.category).toBe('medical');
        expect(result.priority).toBe('high');
    });
});

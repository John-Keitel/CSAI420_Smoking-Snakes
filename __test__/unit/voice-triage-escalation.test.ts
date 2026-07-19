import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

import {
    buildRecentScoresContext,
    createOpenAiLangChainModel,
    detectEscalationRisk,
    enforceSystemPromptGuardrails,
    generateVoiceFeedback,
} from '@/lib/voice-ai';

describe('detectEscalationRisk', () => {
    it('flags sessions containing high-risk language', () => {
        const result = detectEscalationRisk('I had chest pain and severe dizziness after the exercise.');

        expect(result.status).toBe('FLAGGED');
        expect(result.matchedPatterns).toContain('chest pain');
        expect(result.matchedPatterns).toContain('severe dizziness');
    });

    it('keeps non-risk language as normal', () => {
        const result = detectEscalationRisk('I feel steady and ready to continue with tomorrow test.');

        expect(result.status).toBe('NORMAL');
        expect(result.matchedPatterns).toHaveLength(0);
    });
});

describe('buildRecentScoresContext', () => {
    it('injects recent score history and trend information', () => {
        const text = buildRecentScoresContext([
            { score: 42, capturedAt: '2026-07-01T12:00:00Z' },
            { score: 47, capturedAt: '2026-07-05T12:00:00Z' },
            { score: 55, capturedAt: '2026-07-10T12:00:00Z' },
        ]);

        expect(text).toContain('Recent scores: 42, 47, 55.');
        expect(text).toContain('Trend appears improving.');
    });
});

describe('enforceSystemPromptGuardrails', () => {
    it('blocks illegal clinical-advice phrasing', () => {
        const safeText = enforceSystemPromptGuardrails('You should change your medication dosage to 10 mg now.');

        expect(safeText).toMatch(/cannot provide medical advice/i);
    });

    it('preserves safe non-clinical phrasing', () => {
        const safeText = enforceSystemPromptGuardrails('Great consistency this week. Keep your routine and check in with your provider if needed.');

        expect(safeText).toContain('Great consistency this week');
    });
});

describe('generateVoiceFeedback', () => {
    it('returns FLAGGED result for high-risk transcripts', async () => {
        const result = await generateVoiceFeedback({
            score: 28,
            scoreBand: 'low',
            callerTranscript: 'I passed out and now have shortness of breath.',
            recentScores: [{ score: 28 }],
        });

        expect(result.status).toBe('FLAGGED');
        expect(result.message).toMatch(/flagged for immediate follow-up/i);
        expect(result.usedLlm).toBe(false);
    });

    it('uses deterministic fallback when LLM is disabled', async () => {
        const result = await generateVoiceFeedback({
            score: 81,
            scoreBand: 'high',
            callerTranscript: 'I feel better today.',
            recentScores: [{ score: 70 }, { score: 81 }],
        });

        expect(result.status).toBe('NORMAL');
        expect(result.usedLlm).toBe(false);
        expect(result.message).toMatch(/strong|routine/i);
    });
});

describe('createOpenAiLangChainModel', () => {
    it('instantiates a LangChain OpenAI model with provided settings', () => {
        const model = createOpenAiLangChainModel('test-key', 'gpt-4o-mini');

        expect(model).toBeDefined();
    });
});

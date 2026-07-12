import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => ({
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

import { buildScoreAnnouncement, formatScoreForVoice, getPersonalizedFeedback, getScoreBand } from '@/lib/score-announcement';

describe('formatScoreForVoice', () => {
    it('formats a whole number score into a spoken sentence', () => {
        expect(formatScoreForVoice(10)).toBe('Your balance score is 10 out of 100.');
    });

    it('rounds decimal scores', () => {
        expect(formatScoreForVoice(72.6)).toBe('Your balance score is 73 out of 100.');
    });
});

describe('getScoreBand', () => {
    it('classifies low scores', () => {
        expect(getScoreBand(0)).toBe('low');
        expect(getScoreBand(39)).toBe('low');
    });

    it('classifies medium scores', () => {
        expect(getScoreBand(40)).toBe('medium');
        expect(getScoreBand(74)).toBe('medium');
    });

    it('classifies high scores', () => {
        expect(getScoreBand(75)).toBe('high');
        expect(getScoreBand(100)).toBe('high');
    });
});

describe('getPersonalizedFeedback', () => {
    it('recommends a care provider for low scores', () => {
        expect(getPersonalizedFeedback(10)).toMatch(/care provider/i);
    });

    it('encourages continued practice for medium scores', () => {
        expect(getPersonalizedFeedback(50)).toMatch(/keep practicing/i);
    });

    it('gives positive reinforcement for high scores', () => {
        expect(getPersonalizedFeedback(90)).toMatch(/great job/i);
    });
});

describe('buildScoreAnnouncement', () => {
    it('builds a full announcement for a valid score', () => {
        const result = buildScoreAnnouncement(10);

        expect(result.ok).toBe(true);
        expect(result.score).toBe(10);
        expect(result.band).toBe('low');
        expect(result.fullMessage).toContain('Your balance score is 10 out of 100.');
        expect(result.fullMessage).toContain('care provider');
    });

    it('returns a graceful fallback for a missing score', () => {
        const result = buildScoreAnnouncement(undefined);

        expect(result.ok).toBe(false);
        expect(result.score).toBeNull();
        expect(result.fullMessage).toMatch(/weren't able to retrieve/i);
    });

    it('returns a graceful fallback for a non-numeric score', () => {
        const result = buildScoreAnnouncement('not-a-number');

        expect(result.ok).toBe(false);
    });

    it('returns a graceful fallback for an out-of-range score', () => {
        const result = buildScoreAnnouncement(150);

        expect(result.ok).toBe(false);
    });
});

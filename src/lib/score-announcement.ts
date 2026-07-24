import { getAppLogger } from '@/lib/logger';
import { generateVoiceFeedback, RecentBalanceScore, VoiceAiRuntimeOptions, VoiceTriageStatus } from '@/lib/voice-ai';

const logger = getAppLogger('lib:score-announcement');

/**
 * DESIGN ASSUMPTION (see docs/engineering/tdd/2026-07-stedi-voice-ivr.md, open question #6:
 * "What score bands and wording are approved for verbal feedback?" — currently marked TBD).
 *
 * Until product/compliance approves final wording, this module assumes a 0-100 scale
 * (consistent with the {"score": 10} example in ASSIGNMENT.md) with three bands:
 *   - 0-39:  higher fall risk  -> recommend follow-up with a care provider
 *   - 40-74: moderate balance  -> encouraging, keep-practicing message
 *   - 75-100: strong balance   -> positive reinforcement
 *
 * These thresholds and messages are intentionally isolated in one place so they can be
 * updated later without touching the IVR flow or the proxy route.
 */
export const SCORE_BANDS = {
    LOW_MAX: 39,
    MEDIUM_MAX: 74,
} as const;

export type ScoreBand = 'low' | 'medium' | 'high';

export type ScoreAnnouncement = {
    /** True if a valid score was available. False for any failure scenario. */
    ok: boolean;
    /** Raw numeric score, if available. */
    score: number | null;
    /** Which band the score falls into, if available. */
    band: ScoreBand | null;
    /** Score formatted as a sentence suitable for text-to-speech (SCRUM-25). */
    spokenScore: string;
    /** Personalized feedback sentence based on the score band (SCRUM-28). */
    feedback: string;
    /** spokenScore + feedback combined, ready to hand to the IVR (SCRUM-26). */
    fullMessage: string;
};

export type IntelligentScoreAnnouncement = ScoreAnnouncement & {
    triageStatus: VoiceTriageStatus;
    escalationMatches: string[];
    usedLlm: boolean;
};

/**
 * SCRUM-25: Format score for voice output.
 * Converts a raw numeric score into a natural sentence for text-to-speech.
 */
export function formatScoreForVoice(score: number): string {
    const rounded = Math.round(score);
    return `Your balance score is ${rounded} out of 100.`;
}

/**
 * Determines which feedback band a score falls into.
 */
export function getScoreBand(score: number): ScoreBand {
    if (score <= SCORE_BANDS.LOW_MAX) return 'low';
    if (score <= SCORE_BANDS.MEDIUM_MAX) return 'medium';
    return 'high';
}

/**
 * SCRUM-28: Implement personalized feedback logic.
 * Returns a short, encouraging (or appropriately cautious) message based on the score band.
 */
export function getPersonalizedFeedback(score: number): string {
    const band = getScoreBand(score);

    switch (band) {
        case 'low':
            return 'We recommend checking in with your care provider about these results.';
        case 'medium':
            return 'Your balance is good. Keep practicing your exercises regularly.';
        case 'high':
            return 'Great job! Your balance is excellent.';
    }
}

/**
 * SCRUM-26: Implement IVR score announcement.
 * Combines formatting + feedback into a single message the IVR can read aloud.
 *
 * SCRUM-27: Handle API failure scenarios.
 * If the score is missing, not a number, or outside the valid 0-100 range,
 * this returns a safe fallback message instead of throwing, so the IVR call
 * can gracefully tell the user something went wrong rather than crashing.
 */
export function buildScoreAnnouncement(rawScore: unknown): ScoreAnnouncement {
    const score = typeof rawScore === 'number' ? rawScore : Number(rawScore);

    if (rawScore === null || rawScore === undefined || Number.isNaN(score) || score < 0 || score > 100) {
        logger.warn('Unable to build score announcement for invalid score: %s', String(rawScore));

        return {
            ok: false,
            score: null,
            band: null,
            spokenScore: '',
            feedback: '',
            fullMessage: "We're sorry, we weren't able to retrieve your balance score right now. Please try again shortly.",
        };
    }

    const spokenScore = formatScoreForVoice(score);
    const feedback = getPersonalizedFeedback(score);

    return {
        ok: true,
        score,
        band: getScoreBand(score),
        spokenScore,
        feedback,
        fullMessage: `${spokenScore} ${feedback}`,
    };
}

export async function buildIntelligentScoreAnnouncement(
    rawScore: unknown,
    options: {
        callerTranscript?: string;
        recentScores?: RecentBalanceScore[];
        runtimeOptions?: VoiceAiRuntimeOptions;
    } = {}
): Promise<IntelligentScoreAnnouncement> {
    const base = buildScoreAnnouncement(rawScore);

    if (!base.ok || !base.band || base.score === null) {
        return {
            ...base,
            triageStatus: 'NORMAL',
            escalationMatches: [],
            usedLlm: false,
        };
    }

    const aiFeedback = await generateVoiceFeedback(
        {
            score: base.score,
            scoreBand: base.band,
            callerTranscript: options.callerTranscript,
            recentScores: options.recentScores,
        },
        options.runtimeOptions
    );

    return {
        ...base,
        feedback: aiFeedback.message,
        fullMessage: `${base.spokenScore} ${aiFeedback.message}`,
        triageStatus: aiFeedback.status,
        escalationMatches: aiFeedback.matchedPatterns,
        usedLlm: aiFeedback.usedLlm,
    };
}

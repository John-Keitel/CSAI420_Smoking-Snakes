import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:onboarding:guardrails');

/**
 * SCRUM-108: mirrors ILLEGAL_CLINICAL_ADVICE_PATTERNS from src/lib/voice-ai.ts, adapted to
 * detect the *user* asking for clinical/medical advice (rather than the model's own output
 * containing it) — onboarding must never engage with that, only redirect back to signup.
 */
const CLINICAL_ADVICE_REQUEST_PATTERNS: readonly RegExp[] = [
    /\bdiagnos(e|is|ed|ing)\b/i,
    /\bprescri(be|bed|bing|ption)\b/i,
    /\bdosage\b/i,
    /\bmedicat(ion|e|ed)\b/i,
    /\bside effects?\b/i,
    /\bsymptoms?\b/i,
    /\b\d+\s?(mg|ml)\b/i,
    /\bshould i take\b/i,
];

const CLINICAL_REDIRECT_MESSAGE =
    "I can't provide medical advice — please contact a licensed healthcare provider for that. Let's get back to signing you up.";

// Onboarding only ever collects a name, email, date of birth, and password (see
// .specs/features/onboarding-langgraph/design.md) — a genuine attempt at any of those is
// never phrased as a question. A '?' is a strong, low-false-positive signal that the reply
// is a conversational detour rather than an attempt to answer. Callers pass
// treatQuestionMarkAsOffTopic: false for the password field, where '?' can legitimately be
// part of the password itself.
const OFF_TOPIC_QUESTION_PATTERN = /\?/;

const OFF_TOPIC_REDIRECT_MESSAGE = "I can only help with signing up here — your name, email, date of birth, and password. Let's continue.";

export type OffTopicRedirect = { message: string } | null;

export type DetectOffTopicOptions = {
    /** Set to false for fields (e.g. password) where '?' can legitimately be part of a valid value. */
    treatQuestionMarkAsOffTopic?: boolean;
};

/**
 * Runs before field extraction/validation in every COLLECT_* node. When the reply is a
 * clinical-advice request or an unrelated question rather than a genuine attempt at the
 * field, returns a redirect notice instead of treating it as an invalid value. Callers must
 * NOT count this as a failed attempt — see each node's rePromptOrAbandon (SCRUM-107) versus
 * its redirect handling (SCRUM-108).
 */
export function detectOffTopicOrClinicalRequest(replyText: string, options: DetectOffTopicOptions = {}): OffTopicRedirect {
    const { treatQuestionMarkAsOffTopic = true } = options;

    if (CLINICAL_ADVICE_REQUEST_PATTERNS.some((pattern) => pattern.test(replyText))) {
        logger.warn('Guardrail redirected a clinical-advice request during onboarding.');
        return { message: CLINICAL_REDIRECT_MESSAGE };
    }

    if (treatQuestionMarkAsOffTopic && OFF_TOPIC_QUESTION_PATTERN.test(replyText)) {
        logger.warn('Guardrail redirected an off-topic question during onboarding.');
        return { message: OFF_TOPIC_REDIRECT_MESSAGE };
    }

    return null;
}

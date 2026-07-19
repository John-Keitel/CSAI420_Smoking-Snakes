import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatOpenAI } from '@langchain/openai';

import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:voice-ai');

export type VoiceTriageStatus = 'NORMAL' | 'FLAGGED';

export type RecentBalanceScore = {
    score: number;
    capturedAt?: string | number | Date;
};

export type EscalationDecision = {
    status: VoiceTriageStatus;
    matchedPatterns: string[];
    reason: string | null;
};

export type VoiceFeedbackInput = {
    score: number;
    scoreBand: 'low' | 'medium' | 'high';
    callerTranscript?: string;
    recentScores?: RecentBalanceScore[];
};

export type VoiceFeedbackResult = {
    status: VoiceTriageStatus;
    message: string;
    matchedPatterns: string[];
    usedLlm: boolean;
};

export type VoiceAiRuntimeOptions = {
    llmEnabled?: boolean;
    openAiApiKey?: string;
    openAiModel?: string;
};

const HIGH_RISK_KEYWORDS: readonly string[] = [
    'chest pain',
    'fainted',
    'fainting',
    'passed out',
    'shortness of breath',
    'severe dizziness',
    'suicidal',
    'want to die',
    'stroke',
    'cannot breathe',
];

const ILLEGAL_CLINICAL_ADVICE_PATTERNS: readonly RegExp[] = [
    /\bdiagnos(e|is|ed)\b/i,
    /\bprescrib(e|ing|ed)\b/i,
    /\bdosage\b/i,
    /\b\d+\s?(mg|ml)\b/i,
    /\bstop taking\b/i,
    /\bstart taking\b/i,
    /\bchange your medication\b/i,
];

const STRICT_SYSTEM_PROMPT = [
    'You are a safety-constrained IVR assistant for balance-score feedback.',
    'Hard rules you must always follow:',
    '1) Never provide diagnosis, treatment plans, prescriptions, or medication advice.',
    '2) Never claim clinical certainty or emergency triage authority.',
    '3) Keep response to 1-2 short sentences in plain language suitable for voice playback.',
    '4) You may acknowledge score trends and encourage follow-up with a licensed clinician.',
    '5) If caller language indicates acute risk or medical danger, output only: "Your session has been flagged for immediate follow-up by a clinician."',
].join('\n');

export function createOpenAiLangChainModel(apiKey: string, modelName: string): ChatOpenAI {
    return new ChatOpenAI({
        apiKey,
        model: modelName,
        temperature: 0.2,
    });
}

export function createVoiceFeedbackPipeline(model: ChatOpenAI) {
    const prompt = ChatPromptTemplate.fromMessages([
        ['system', STRICT_SYSTEM_PROMPT],
        [
            'human',
            [
                'Generate IVR-safe balance feedback.',
                'Current score: {score}',
                'Score band: {scoreBand}',
                'Recent score context: {recentScoresContext}',
                'Caller transcript: {callerTranscript}',
            ].join('\n'),
        ],
    ]);

    return RunnableSequence.from([prompt, model, new StringOutputParser()]);
}

export function detectEscalationRisk(inputText: string): EscalationDecision {
    const normalized = inputText.toLowerCase();
    const matchedPatterns = HIGH_RISK_KEYWORDS.filter((keyword) => normalized.includes(keyword));

    if (matchedPatterns.length === 0) {
        return {
            status: 'NORMAL',
            matchedPatterns: [],
            reason: null,
        };
    }

    return {
        status: 'FLAGGED',
        matchedPatterns,
        reason: 'Detected high-risk medical language requiring clinician escalation.',
    };
}

export function buildRecentScoresContext(scores: readonly RecentBalanceScore[] = []): string {
    if (scores.length === 0) {
        return 'No recent balance tests available.';
    }

    const sorted = [...scores].sort((a, b) => {
        const aTime = a.capturedAt ? new Date(a.capturedAt).getTime() : 0;
        const bTime = b.capturedAt ? new Date(b.capturedAt).getTime() : 0;
        return aTime - bTime;
    });

    const recent = sorted.slice(-5);
    const values = recent.map((item) => item.score);
    const first = values[0];
    const last = values[values.length - 1];
    const trend =
        last > first
            ? 'improving'
            : last < first
              ? 'declining'
              : 'stable';

    return `Recent scores: ${values.join(', ')}. Trend appears ${trend}.`;
}

export function enforceSystemPromptGuardrails(text: string): string {
    for (const pattern of ILLEGAL_CLINICAL_ADVICE_PATTERNS) {
        if (pattern.test(text)) {
            logger.warn('Guardrail blocked prohibited clinical-advice phrasing in model output.');
            return 'I cannot provide medical advice. Please contact your licensed healthcare provider for clinical guidance.';
        }
    }

    return text;
}

function fallbackFeedback(scoreBand: VoiceFeedbackInput['scoreBand']): string {
    if (scoreBand === 'low') {
        return 'Your score suggests extra caution today. Please follow up with your care provider for next steps.';
    }

    if (scoreBand === 'medium') {
        return 'Your score is in a moderate range. Keep practicing your balance exercises and monitor progress.';
    }

    return 'Your score is strong today. Keep your routine going and continue regular check-ins.';
}

export async function generateVoiceFeedback(
    input: VoiceFeedbackInput,
    options: VoiceAiRuntimeOptions = {}
): Promise<VoiceFeedbackResult> {
    const escalation = detectEscalationRisk(input.callerTranscript ?? '');

    if (escalation.status === 'FLAGGED') {
        return {
            status: 'FLAGGED',
            matchedPatterns: escalation.matchedPatterns,
            message: 'Your session has been flagged for immediate follow-up by a clinician.',
            usedLlm: false,
        };
    }

    const recentScoresContext = buildRecentScoresContext(input.recentScores ?? []);

    if (!options.llmEnabled || !options.openAiApiKey) {
        return {
            status: 'NORMAL',
            matchedPatterns: [],
            message: fallbackFeedback(input.scoreBand),
            usedLlm: false,
        };
    }

    try {
        const model = createOpenAiLangChainModel(options.openAiApiKey, options.openAiModel ?? 'gpt-4o-mini');
        const chain = createVoiceFeedbackPipeline(model);
        const output = await chain.invoke({
            score: input.score,
            scoreBand: input.scoreBand,
            recentScoresContext,
            callerTranscript: input.callerTranscript ?? 'No caller transcript provided.',
        });

        return {
            status: 'NORMAL',
            matchedPatterns: [],
            message: enforceSystemPromptGuardrails(String(output).trim()),
            usedLlm: true,
        };
    } catch (error) {
        logger.error('Voice feedback pipeline failed: %s', error);

        return {
            status: 'NORMAL',
            matchedPatterns: [],
            message: fallbackFeedback(input.scoreBand),
            usedLlm: false,
        };
    }
}

export async function generateVoiceFeedbackFromEnv(input: VoiceFeedbackInput): Promise<VoiceFeedbackResult> {
    const { ENV_VARS } = await import('@/lib/env-vars');

    return generateVoiceFeedback(input, {
        llmEnabled: ENV_VARS.VOICE_LLM_ENABLED,
        openAiApiKey: ENV_VARS.OPENAI_API_KEY,
        openAiModel: ENV_VARS.OPENAI_MODEL,
    });
}

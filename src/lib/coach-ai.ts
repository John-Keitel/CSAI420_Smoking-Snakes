import { ChatPromptTemplate } from '@langchain/core/prompts';
import { ChatOpenAI } from '@langchain/openai';
import { z } from 'zod';

import { prisma } from '@/lib/db';
import { ENV_VARS } from '@/lib/env-vars';

const SEVERE_MOBILITY_DROP_THRESHOLD = 20;

const coachResponseSchema = z.object({
    responseText: z.string().min(1).describe('Warm, high-contrast plain-language coaching text optimized for elderly screen readers.'),
    deepBehavioralLogExportRecommendation: z
        .enum(['allow', 'deny'])
        .describe('Allow deep behavioral log exports only when clinician token access is active and approved.'),
    medicalSafetyNotice: z
        .string()
        .min(1)
        .describe('Explicitly reject diagnosis or prescription-like guidance and remind users this is not medical advice.'),
    escalate: z.boolean().describe('Set true when severe mobility impairment is detected by score drop logic.'),
});

export type CoachAiInput = {
    customerEmail: string;
    currentBalanceScore: number;
    previousBalanceScore?: number | null;
    patientContext?: string;
};

export type CoachAiResponse = z.infer<typeof coachResponseSchema>;

const coachPromptTemplate = ChatPromptTemplate.fromMessages([
    [
        'system',
        [
            'You are a mobility coaching assistant for older adults.',
            'You must produce emotionally warm but clear language suitable for elderly screen readers.',
            'Use high-contrast text descriptions: plain words, short sentences, explicit action verbs, and no decorative symbols.',
            'Never imitate or suggest medical prescriptions, dosage instructions, or clinical diagnoses.',
            'If a request implies diagnosis/prescription framing, explicitly reject that framing and provide a safe non-clinical alternative.',
            'Only recommend deep behavioral log exports when clinicianTokenActive is true.',
            'Return a JSON object matching the provided schema and do not add extra keys.',
            'If severeMobilityImpairment is true, escalate must be true.',
        ].join(' '),
    ],
    [
        'human',
        [
            'Patient context: {patientContext}',
            'Current balance score: {currentBalanceScore}',
            'Previous balance score: {previousBalanceScore}',
            'Score drop: {scoreDrop}',
            'Severe mobility impairment flag: {severeMobilityImpairment}',
            'Clinician token active and approved: {clinicianTokenActive}',
            'Provide coaching output now.',
        ].join('\n'),
    ],
]);

let modelSingleton: ChatOpenAI | null | undefined;

function getCoachModel(): ChatOpenAI | null {
    if (modelSingleton !== undefined) {
        return modelSingleton;
    }

    const apiKey = ENV_VARS.OPENAI_API_KEY;
    if (!apiKey) {
        modelSingleton = null;
        return modelSingleton;
    }

    modelSingleton = new ChatOpenAI({
        apiKey,
        model: 'gpt-4o',
        temperature: 0.2,
    });

    return modelSingleton;
}

function roundScore(value: number): number {
    return Number(value.toFixed(2));
}

function hasSevereMobilityImpairment(currentBalanceScore: number, previousBalanceScore?: number | null): boolean {
    if (previousBalanceScore == null || Number.isNaN(previousBalanceScore)) {
        return false;
    }

    const scoreDrop = previousBalanceScore - currentBalanceScore;
    return scoreDrop >= SEVERE_MOBILITY_DROP_THRESHOLD;
}

async function hasActiveApprovedClinicianToken(customerEmail: string): Promise<boolean> {
    const now = new Date();

    const record = await prisma.clinicianAccessRequest.findFirst({
        where: {
            customerEmail,
            status: 'APPROVED',
            accessToken: {
                not: null,
            },
            tokenExpiresAt: {
                gt: now,
            },
            expiresAt: {
                gt: now,
            },
        },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
    });

    return Boolean(record?.id);
}

function fallbackResponse(severeMobilityImpairment: boolean, clinicianTokenActive: boolean): CoachAiResponse {
    return {
        responseText:
            'Your movement score changed today. Keep your steps slow and steady, and use support nearby when needed. We can focus on safe, simple movement practice and review progress again soon.',
        deepBehavioralLogExportRecommendation: clinicianTokenActive ? 'allow' : 'deny',
        medicalSafetyNotice:
            'I cannot provide medical prescriptions or clinical diagnoses. For diagnosis or medication decisions, please contact a licensed clinician.',
        escalate: severeMobilityImpairment,
    };
}

export async function generateCoachAiResponse(input: CoachAiInput): Promise<CoachAiResponse> {
    const clinicianTokenActive = await hasActiveApprovedClinicianToken(input.customerEmail);
    const severeMobilityImpairment = hasSevereMobilityImpairment(input.currentBalanceScore, input.previousBalanceScore);

    const previousScore = input.previousBalanceScore ?? input.currentBalanceScore;
    const scoreDrop = roundScore(Math.max(0, previousScore - input.currentBalanceScore));

    const model = getCoachModel();
    if (!model) {
        return fallbackResponse(severeMobilityImpairment, clinicianTokenActive);
    }

    const structuredModel = model.withStructuredOutput(coachResponseSchema);
    const prompt = await coachPromptTemplate.formatMessages({
        patientContext: input.patientContext ?? 'No additional patient context provided.',
        currentBalanceScore: roundScore(input.currentBalanceScore),
        previousBalanceScore: roundScore(previousScore),
        scoreDrop,
        severeMobilityImpairment,
        clinicianTokenActive,
    });

    const aiResponse = await structuredModel.invoke(prompt);

    return {
        ...aiResponse,
        deepBehavioralLogExportRecommendation: clinicianTokenActive ? aiResponse.deepBehavioralLogExportRecommendation : 'deny',
        escalate: severeMobilityImpairment ? true : aiResponse.escalate,
    };
}

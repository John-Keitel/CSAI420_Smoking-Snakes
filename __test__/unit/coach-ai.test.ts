import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockRecord = { id: string } | null;

type AiResponse = {
    responseText: string;
    deepBehavioralLogExportRecommendation: 'allow' | 'deny';
    medicalSafetyNotice: string;
    escalate: boolean;
};

const defaultAiResponse: AiResponse = {
    responseText: 'Warm coaching response.',
    deepBehavioralLogExportRecommendation: 'allow',
    medicalSafetyNotice: 'No diagnosis provided.',
    escalate: false,
};

async function loadCoachModule(options: {
    openAiApiKey?: string | undefined;
    clinicianRecord: MockRecord;
    aiResponse?: AiResponse;
}) {
    vi.resetModules();

    const findFirstMock = vi.fn().mockResolvedValue(options.clinicianRecord);
    const invokeMock = vi.fn().mockResolvedValue(options.aiResponse ?? defaultAiResponse);

    vi.doMock('@/lib/db', () => ({
        prisma: {
            clinicianAccessRequest: {
                findFirst: findFirstMock,
            },
        },
    }));

    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: {
            OPENAI_API_KEY: options.openAiApiKey,
        },
    }));

    vi.doMock('@langchain/core/prompts', () => ({
        ChatPromptTemplate: {
            fromMessages: () => ({
                formatMessages: vi.fn().mockResolvedValue([{ role: 'system', content: 'mock prompt' }]),
            }),
        },
    }));

    vi.doMock('@langchain/openai', () => {
        class MockChatOpenAI {
            constructor(_config: unknown) {}

            withStructuredOutput() {
                return {
                    invoke: invokeMock,
                };
            }
        }

        return {
            ChatOpenAI: MockChatOpenAI,
        };
    });

    const coachModule = await import('@/lib/coach-ai');

    return {
        coachModule,
        findFirstMock,
        invokeMock,
    };
}

describe('generateCoachAiResponse', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Case A: allows deep export only when an approved active clinician token exists, otherwise denies', async () => {
        const active = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: { id: 'approved-token-record' },
            aiResponse: {
                ...defaultAiResponse,
                deepBehavioralLogExportRecommendation: 'allow',
            },
        });

        const activeResult = await active.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 70,
            previousBalanceScore: 72,
            patientContext: 'Needs gentle coaching reminders.',
        });

        expect(active.findFirstMock).toHaveBeenCalledOnce();
        expect(activeResult.deepBehavioralLogExportRecommendation).toBe('allow');

        const inactive = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: null,
            aiResponse: {
                ...defaultAiResponse,
                deepBehavioralLogExportRecommendation: 'allow',
            },
        });

        const inactiveResult = await inactive.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 70,
            previousBalanceScore: 72,
        });

        expect(inactive.findFirstMock).toHaveBeenCalledOnce();
        expect(inactiveResult.deepBehavioralLogExportRecommendation).toBe('deny');
    });

    it('Case B: forces escalate true when score drop is severe, regardless of AI output', async () => {
        const loaded = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: { id: 'approved-token-record' },
            aiResponse: {
                ...defaultAiResponse,
                escalate: false,
            },
        });

        const result = await loaded.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 50,
            previousBalanceScore: 75,
        });

        expect(loaded.invokeMock).toHaveBeenCalledOnce();
        expect(result.escalate).toBe(true);
    });

    it('Case C: returns fallback response without throwing when OPENAI_API_KEY is missing', async () => {
        const loaded = await loadCoachModule({
            openAiApiKey: undefined,
            clinicianRecord: null,
        });

        await expect(
            loaded.coachModule.generateCoachAiResponse({
                customerEmail: 'patient@example.com',
                currentBalanceScore: 62,
                previousBalanceScore: 65,
            })
        ).resolves.toEqual({
            responseText:
                'Your movement score changed today. Keep your steps slow and steady, and use support nearby when needed. We can focus on safe, simple movement practice and review progress again soon.',
            deepBehavioralLogExportRecommendation: 'deny',
            medicalSafetyNotice:
                'I cannot provide medical prescriptions or clinical diagnoses. For diagnosis or medication decisions, please contact a licensed clinician.',
            escalate: false,
        });

        expect(loaded.invokeMock).not.toHaveBeenCalled();
    });
});

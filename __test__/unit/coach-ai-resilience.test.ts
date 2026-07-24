import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockRecord = { id: string } | null;

type AiResponse = {
    responseText: string;
    deepBehavioralLogExportRecommendation: 'allow' | 'deny';
    medicalSafetyNotice: string;
    escalate: boolean;
};

const defaultAiResponse: AiResponse = {
    responseText: 'Structured coaching response',
    deepBehavioralLogExportRecommendation: 'allow',
    medicalSafetyNotice: 'No diagnosis provided.',
    escalate: false,
};

async function loadCoachModule(options: {
    clinicianRecord: MockRecord;
    openAiApiKey?: string;
    aiInvokeResult?: AiResponse;
    aiInvokeError?: Error;
}) {
    vi.resetModules();

    const findFirstMock = vi.fn().mockResolvedValue(options.clinicianRecord);
    const formatMessagesMock = vi.fn().mockResolvedValue([{ role: 'system', content: 'mock prompt' }]);
    const invokeMock = options.aiInvokeError
        ? vi.fn().mockRejectedValue(options.aiInvokeError)
        : vi.fn().mockResolvedValue(options.aiInvokeResult ?? defaultAiResponse);

    const logger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };

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

    vi.doMock('@/lib/logger', () => ({
        getAppLogger: () => logger,
    }));

    vi.doMock('@langchain/core/prompts', () => ({
        ChatPromptTemplate: {
            fromMessages: () => ({
                formatMessages: formatMessagesMock,
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
        formatMessagesMock,
        invokeMock,
        logger,
    };
}

describe('coach-ai resilience hardening', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns structured schema output on successful LLM execution', async () => {
        const loaded = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: { id: 'approved-token-record' },
        });

        const result = await loaded.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 76,
            previousBalanceScore: 79,
            patientContext: 'Patient reports mild instability when standing up quickly.',
        });

        expect(loaded.invokeMock).toHaveBeenCalledOnce();
        expect(result).toMatchObject({
            responseText: expect.any(String),
            deepBehavioralLogExportRecommendation: 'allow',
            medicalSafetyNotice: expect.any(String),
            escalate: false,
        });
        expect(loaded.logger.info).toHaveBeenCalled();
    });

    it('falls back safely when OpenAI invocation fails with network or timeout errors', async () => {
        const networkFailure = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: null,
            aiInvokeError: new Error('network error'),
        });

        const networkResult = await networkFailure.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 62,
            previousBalanceScore: 64,
            patientContext: 'Need supportive guidance.',
        });

        expect(networkResult).toMatchObject({
            deepBehavioralLogExportRecommendation: 'deny',
            medicalSafetyNotice: expect.stringContaining('cannot provide medical prescriptions'),
        });
        expect(networkFailure.logger.error).toHaveBeenCalled();

        const timeoutFailure = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: null,
            aiInvokeError: new Error('OpenAI timeout after 8000ms'),
        });

        const timeoutResult = await timeoutFailure.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 58,
            previousBalanceScore: 63,
        });

        expect(timeoutResult).toMatchObject({
            deepBehavioralLogExportRecommendation: 'deny',
            medicalSafetyNotice: expect.stringContaining('cannot provide medical prescriptions'),
        });
        expect(timeoutFailure.logger.error).toHaveBeenCalled();
    });

    it('falls back safely when OPENAI_API_KEY is missing', async () => {
        const loaded = await loadCoachModule({
            openAiApiKey: undefined,
            clinicianRecord: null,
        });

        const result = await loaded.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 67,
            previousBalanceScore: 69,
            patientContext: 'Need short safe guidance for daily movement.',
        });

        expect(result).toMatchObject({
            deepBehavioralLogExportRecommendation: 'deny',
            medicalSafetyNotice: expect.stringContaining('cannot provide medical prescriptions'),
            responseText: expect.any(String),
        });
        expect(loaded.invokeMock).not.toHaveBeenCalled();
        expect(loaded.logger.warn).toHaveBeenCalled();
    });

    it('enforces behavioral export gating based on active approved clinician token', async () => {
        const active = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: { id: 'approved-token-record' },
            aiInvokeResult: {
                ...defaultAiResponse,
                deepBehavioralLogExportRecommendation: 'allow',
            },
        });

        const activeResult = await active.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 80,
        });

        expect(activeResult.deepBehavioralLogExportRecommendation).toBe('allow');

        const inactive = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: null,
            aiInvokeResult: {
                ...defaultAiResponse,
                deepBehavioralLogExportRecommendation: 'allow',
            },
        });

        const inactiveResult = await inactive.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 80,
        });

        expect(inactiveResult.deepBehavioralLogExportRecommendation).toBe('deny');
    });

    it('sanitizes and truncates patientContext according to operational limits', async () => {
        const loaded = await loadCoachModule({
            openAiApiKey: 'test-key',
            clinicianRecord: { id: 'approved-token-record' },
        });

        const oversizedContext = `${'A'.repeat(700)} <script>alert(1)</script> {malicious} \n\n\t text`;

        await loaded.coachModule.generateCoachAiResponse({
            customerEmail: 'patient@example.com',
            currentBalanceScore: 72,
            patientContext: oversizedContext,
        });

        expect(loaded.formatMessagesMock).toHaveBeenCalledOnce();

        const promptInput = loaded.formatMessagesMock.mock.calls[0][0] as { patientContext: string };
        expect(promptInput.patientContext.length).toBeLessThanOrEqual(500);
        expect(promptInput.patientContext).not.toContain('<script>');
        expect(promptInput.patientContext).not.toContain('{');
        expect(promptInput.patientContext).not.toContain('}');
    });
});

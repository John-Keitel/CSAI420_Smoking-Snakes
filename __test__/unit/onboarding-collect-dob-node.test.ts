import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type NameExtraction = { extractedName: string; looksLikeAValidFullName: boolean };
type EmailExtraction = { extractedEmail: string; looksLikeAValidEmail: boolean };
type DobExtraction = { extractedDob: string; looksLikeAValidDob: boolean };

const DEFAULT_VALID_NAME: NameExtraction = { extractedName: 'John Smith', looksLikeAValidFullName: true };
const DEFAULT_VALID_EMAIL: EmailExtraction = { extractedEmail: 'john@example.com', looksLikeAValidEmail: true };

function isoDateYearsFromToday(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().slice(0, 10);
}

async function loadGraphModule(options: {
    openAiApiKey?: string;
    nameExtraction?: NameExtraction;
    emailExtraction?: EmailExtraction;
    dobExtraction?: DobExtraction | 'throw';
}) {
    vi.resetModules();

    const greetingInvokeMock = vi.fn().mockResolvedValue({ content: 'Hi there.' });
    const nameInvokeMock = vi.fn().mockResolvedValue(options.nameExtraction ?? DEFAULT_VALID_NAME);
    const emailInvokeMock = vi.fn().mockResolvedValue(options.emailExtraction ?? DEFAULT_VALID_EMAIL);
    const dobInvokeMock =
        options.dobExtraction === 'throw'
            ? vi.fn().mockRejectedValue(new Error('boom'))
            : vi.fn().mockResolvedValue(options.dobExtraction ?? { extractedDob: '', looksLikeAValidDob: false });

    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: { OPENAI_API_KEY: options.openAiApiKey, OPENAI_MODEL: 'gpt-4o-mini' },
    }));

    vi.doMock('@langchain/openai', () => {
        class MockChatOpenAI {
            constructor(_config: unknown) {}

            invoke(...args: unknown[]) {
                return greetingInvokeMock(...args);
            }

            withStructuredOutput(schema: { shape?: Record<string, unknown> }) {
                const fields = Object.keys(schema?.shape ?? {});
                if (fields.includes('extractedEmail')) {
                    return { invoke: emailInvokeMock };
                }
                if (fields.includes('extractedDob')) {
                    return { invoke: dobInvokeMock };
                }
                return { invoke: nameInvokeMock };
            }
        }

        return { ChatOpenAI: MockChatOpenAI };
    });

    const { onboardingGraph } = await import('@/lib/onboarding/graph');
    return { onboardingGraph, greetingInvokeMock, nameInvokeMock, emailInvokeMock, dobInvokeMock };
}

/** Runs the graph past GREETING, a valid name, and a valid email so it pauses at COLLECT_DOB. */
async function advanceToCollectDob(onboardingGraph: Awaited<ReturnType<typeof loadGraphModule>>['onboardingGraph'], threadConfig: object) {
    await onboardingGraph.invoke({}, threadConfig);
    await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);
    return onboardingGraph.invoke(new Command({ resume: 'john@example.com' }), threadConfig);
}

describe('collectDobNode (SCRUM-104)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pauses at COLLECT_DOB asking for the date of birth once a valid email is collected', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key' });
        const threadConfig = { configurable: { thread_id: 'scrum-104-pause' } };

        const result = await advanceToCollectDob(onboardingGraph, threadConfig);

        expect(isInterrupted(result)).toBe(true);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).toBe("What's your date of birth?");
        }
    });

    it('completes the graph when the reply is a valid, plausible date of birth', async () => {
        const validDob = isoDateYearsFromToday(-30);
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            dobExtraction: { extractedDob: validDob, looksLikeAValidDob: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-104-valid' } };

        await advanceToCollectDob(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: validDob }), threadConfig);

        expect(isInterrupted(result)).toBe(false);
        expect(result.collectedDob).toBe(validDob);
        expect(result.lastValidationError).toBeNull();
    });

    it('loops back to COLLECT_DOB with a re-prompt when the reply is not a plausible date', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            dobExtraction: { extractedDob: '', looksLikeAValidDob: false },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-104-invalid' } };

        await advanceToCollectDob(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'not a date' }), threadConfig);

        expect(result.collectedDob).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).not.toBe("What's your date of birth?");
        }
    });

    it('rejects a future date even when the model claims it is valid', async () => {
        const futureDob = isoDateYearsFromToday(1);
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            dobExtraction: { extractedDob: futureDob, looksLikeAValidDob: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-104-future' } };

        await advanceToCollectDob(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'next year' }), threadConfig);

        expect(result.collectedDob).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('rejects an implausibly old date (>120 years) even when the model claims it is valid', async () => {
        const tooOldDob = isoDateYearsFromToday(-130);
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            dobExtraction: { extractedDob: tooOldDob, looksLikeAValidDob: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-104-too-old' } };

        await advanceToCollectDob(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: '130 years ago' }), threadConfig);

        expect(result.collectedDob).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('falls back to a deterministic re-prompt when the DOB extraction model call fails', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key', dobExtraction: 'throw' });
        const threadConfig = { configurable: { thread_id: 'scrum-104-model-error' } };

        await advanceToCollectDob(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: isoDateYearsFromToday(-30) }), threadConfig);

        expect(result.collectedDob).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });
});

describe('onboarding graph full-cycle smoke test (SCRUM-100–104)', () => {
    it('walks GREETING → COLLECT_NAME → COLLECT_EMAIL → COLLECT_DOB → END with all valid replies on the first attempt', async () => {
        const validDob = isoDateYearsFromToday(-30);
        const { onboardingGraph, greetingInvokeMock, nameInvokeMock, emailInvokeMock, dobInvokeMock } = await loadGraphModule({
            openAiApiKey: 'test-key',
            dobExtraction: { extractedDob: validDob, looksLikeAValidDob: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-104-full-cycle' } };

        const afterGreeting = await onboardingGraph.invoke({}, threadConfig);
        expect(isInterrupted(afterGreeting)).toBe(true);
        expect(afterGreeting.messages).toHaveLength(1);

        const afterName = await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);
        expect(isInterrupted(afterName)).toBe(true);
        expect(afterName.collectedName).toBe('John Smith');

        const afterEmail = await onboardingGraph.invoke(new Command({ resume: 'john@example.com' }), threadConfig);
        expect(isInterrupted(afterEmail)).toBe(true);
        expect(afterEmail.collectedEmail).toBe('john@example.com');

        const final = await onboardingGraph.invoke(new Command({ resume: validDob }), threadConfig);
        expect(isInterrupted(final)).toBe(false);
        expect(final.collectedName).toBe('John Smith');
        expect(final.collectedEmail).toBe('john@example.com');
        expect(final.collectedDob).toBe(validDob);
        expect(final.lastValidationError).toBeNull();

        expect(greetingInvokeMock).toHaveBeenCalledOnce();
        expect(nameInvokeMock).toHaveBeenCalledOnce();
        expect(emailInvokeMock).toHaveBeenCalledOnce();
        expect(dobInvokeMock).toHaveBeenCalledOnce();
    });
});

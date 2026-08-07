import { Command, INTERRUPT, isInterrupted } from '@langchain/langgraph';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type NameExtraction = { extractedName: string; looksLikeAValidFullName: boolean };
type EmailExtraction = { extractedEmail: string; looksLikeAValidEmail: boolean };
type DobExtraction = { extractedDob: string; looksLikeAValidDob: boolean };
type PasswordExtraction = { extractedPassword: string; looksLikeAPasswordAttempt: boolean };
type LoggerSpy = {
    debug: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
};

const DEFAULT_VALID_NAME: NameExtraction = { extractedName: 'John Smith', looksLikeAValidFullName: true };
const DEFAULT_VALID_EMAIL: EmailExtraction = { extractedEmail: 'john@example.com', looksLikeAValidEmail: true };

function isoDateYearsFromToday(years: number): string {
    const date = new Date();
    date.setFullYear(date.getFullYear() + years);
    return date.toISOString().slice(0, 10);
}

const VALID_DOB = isoDateYearsFromToday(-30);
const DEFAULT_VALID_DOB: DobExtraction = { extractedDob: VALID_DOB, looksLikeAValidDob: true };

async function loadGraphModule(options: {
    openAiApiKey?: string;
    nameExtraction?: NameExtraction;
    emailExtraction?: EmailExtraction;
    dobExtraction?: DobExtraction;
    passwordExtraction?: PasswordExtraction | 'throw';
}) {
    vi.resetModules();

    const logger: LoggerSpy = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };

    const greetingInvokeMock = vi.fn().mockResolvedValue({ content: 'Hi there.' });
    const nameInvokeMock = vi.fn().mockResolvedValue(options.nameExtraction ?? DEFAULT_VALID_NAME);
    const emailInvokeMock = vi.fn().mockResolvedValue(options.emailExtraction ?? DEFAULT_VALID_EMAIL);
    const dobInvokeMock = vi.fn().mockResolvedValue(options.dobExtraction ?? DEFAULT_VALID_DOB);
    const passwordInvokeMock =
        options.passwordExtraction === 'throw'
            ? vi.fn().mockRejectedValue(new Error('boom'))
            : vi.fn().mockResolvedValue(options.passwordExtraction ?? { extractedPassword: '', looksLikeAPasswordAttempt: false });

    vi.doMock('@/lib/env-vars', () => ({
        ENV_VARS: { OPENAI_API_KEY: options.openAiApiKey, OPENAI_MODEL: 'gpt-4o-mini' },
    }));

    vi.doMock('@/lib/logger', () => ({
        getAppLogger: () => logger,
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
                if (fields.includes('extractedPassword')) {
                    return { invoke: passwordInvokeMock };
                }
                return { invoke: nameInvokeMock };
            }
        }

        return { ChatOpenAI: MockChatOpenAI };
    });

    const { onboardingGraph } = await import('@/lib/onboarding/graph');
    return { onboardingGraph, logger, greetingInvokeMock, nameInvokeMock, emailInvokeMock, dobInvokeMock, passwordInvokeMock };
}

/** Runs the graph past GREETING and a valid name/email/DOB so it pauses at COLLECT_PASSWORD. */
async function advanceToCollectPassword(onboardingGraph: Awaited<ReturnType<typeof loadGraphModule>>['onboardingGraph'], threadConfig: object) {
    await onboardingGraph.invoke({}, threadConfig);
    await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);
    await onboardingGraph.invoke(new Command({ resume: 'john@example.com' }), threadConfig);
    return onboardingGraph.invoke(new Command({ resume: VALID_DOB }), threadConfig);
}

/** Flattens every argument ever passed to any logger method into one searchable string. */
function allLoggedText(logger: LoggerSpy): string {
    return Object.values(logger)
        .flatMap((fn) => fn.mock.calls)
        .flat()
        .map((arg) => (typeof arg === 'string' ? arg : JSON.stringify(arg)))
        .join(' | ');
}

describe('collectPasswordNode (SCRUM-105)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('pauses at COLLECT_PASSWORD asking for a password once a valid DOB is collected', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key' });
        const threadConfig = { configurable: { thread_id: 'scrum-105-pause' } };

        const result = await advanceToCollectPassword(onboardingGraph, threadConfig);

        expect(isInterrupted(result)).toBe(true);
        if (isInterrupted<{ question: string }>(result)) {
            expect(result[INTERRUPT][0].value?.question).toContain('password');
        }
    });

    it('completes the graph and stores only a bcrypt hash when the reply is a valid password', async () => {
        const plaintext = 'Sup3rSecret!';
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            passwordExtraction: { extractedPassword: plaintext, looksLikeAPasswordAttempt: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-105-valid' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: plaintext }), threadConfig);

        expect(isInterrupted(result)).toBe(false);
        expect(result.step).toBe('COMPLETE');
        expect(result.collectedPasswordHash).toBeTruthy();
        expect(result.collectedPasswordHash).not.toBe(plaintext);
        expect(result.collectedPasswordHash as string).not.toContain(plaintext);
        expect(result.lastValidationError).toBeNull();
    });

    it('loops back to COLLECT_PASSWORD with a re-prompt when the reply is not a plausible password attempt', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            passwordExtraction: { extractedPassword: '', looksLikeAPasswordAttempt: false },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-105-invalid' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'what do you mean?' }), threadConfig);

        expect(result.collectedPasswordHash).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
    });

    it('rejects an extraction that fails the Zod guardrail even when the model claims it is valid', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            passwordExtraction: { extractedPassword: 'short1', looksLikeAPasswordAttempt: true },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-105-guardrail' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'short1' }), threadConfig);

        expect(result.collectedPasswordHash).toBeNull();
        expect(isInterrupted(result)).toBe(true);
    });

    it('validates the raw reply against the guardrail schema when OPENAI_API_KEY is unset', async () => {
        const plaintext = 'Correct-Horse9';
        const { onboardingGraph, passwordInvokeMock } = await loadGraphModule({ openAiApiKey: undefined });
        const threadConfig = { configurable: { thread_id: 'scrum-105-fallback-valid' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: plaintext }), threadConfig);

        expect(passwordInvokeMock).not.toHaveBeenCalled();
        expect(result.step).toBe('COMPLETE');
        expect(result.collectedPasswordHash).toBeTruthy();
        expect(result.collectedPasswordHash).not.toBe(plaintext);
        expect(isInterrupted(result)).toBe(false);
    });

    it('re-prompts when OPENAI_API_KEY is unset and the raw reply also fails the guardrail schema', async () => {
        const { onboardingGraph, passwordInvokeMock } = await loadGraphModule({ openAiApiKey: undefined });
        const threadConfig = { configurable: { thread_id: 'scrum-105-fallback-invalid' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'short1' }), threadConfig);

        expect(passwordInvokeMock).not.toHaveBeenCalled();
        expect(result.collectedPasswordHash).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
    });

    it('validates the raw reply against the guardrail schema when the model call fails', async () => {
        const plaintext = 'Correct-Horse9';
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key', passwordExtraction: 'throw' });
        const threadConfig = { configurable: { thread_id: 'scrum-105-model-error-valid' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: plaintext }), threadConfig);

        expect(result.step).toBe('COMPLETE');
        expect(result.collectedPasswordHash).toBeTruthy();
        expect(result.collectedPasswordHash).not.toBe(plaintext);
        expect(isInterrupted(result)).toBe(false);
    });

    it('re-prompts when the model call fails and the raw reply also fails the guardrail schema', async () => {
        const { onboardingGraph } = await loadGraphModule({ openAiApiKey: 'test-key', passwordExtraction: 'throw' });
        const threadConfig = { configurable: { thread_id: 'scrum-105-model-error-invalid' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'short1' }), threadConfig);

        expect(result.collectedPasswordHash).toBeNull();
        expect(result.lastValidationError).toBeTruthy();
        expect(isInterrupted(result)).toBe(true);
    });

    it('abandons the flow after 3 consecutive failed attempts instead of looping forever', async () => {
        const { onboardingGraph } = await loadGraphModule({
            openAiApiKey: 'test-key',
            passwordExtraction: { extractedPassword: '', looksLikeAPasswordAttempt: false },
        });
        const threadConfig = { configurable: { thread_id: 'scrum-105-abandon' } };

        await advanceToCollectPassword(onboardingGraph, threadConfig);
        await onboardingGraph.invoke(new Command({ resume: 'short1' }), threadConfig);
        await onboardingGraph.invoke(new Command({ resume: 'short1' }), threadConfig);
        const result = await onboardingGraph.invoke(new Command({ resume: 'short1' }), threadConfig);

        expect(isInterrupted(result)).toBe(false);
        expect(result.step).toBe('ABANDONED');
        expect(result.collectedPasswordHash).toBeNull();
        expect(result.messages[result.messages.length - 1]?.content).toBeTruthy();
    });

    describe('guardrails (SCRUM-108)', () => {
        it('redirects a clinical-advice request without giving medical advice, without calling the model, and without consuming an attempt', async () => {
            const { onboardingGraph, passwordInvokeMock } = await loadGraphModule({ openAiApiKey: 'test-key' });
            const threadConfig = { configurable: { thread_id: 'scrum-108-password-clinical' } };

            const beforeDetour = await advanceToCollectPassword(onboardingGraph, threadConfig);
            const afterDetour = await onboardingGraph.invoke(new Command({ resume: 'I need advice on my medication dosage' }), threadConfig);

            expect(passwordInvokeMock).not.toHaveBeenCalled();
            expect(afterDetour.collectedPasswordHash).toBeNull();
            expect(afterDetour.fieldAttempts).toBe(beforeDetour.fieldAttempts);
            expect(isInterrupted(afterDetour)).toBe(true);
            const lastMessage = String(afterDetour.messages[afterDetour.messages.length - 1]?.content ?? '');
            expect(lastMessage.toLowerCase()).toContain('medical advice');
        });

        it('does not redirect a password containing "?" — it is a legitimate complexity character here', async () => {
            const plaintext = 'Correct-Horse9?';
            const { onboardingGraph } = await loadGraphModule({
                openAiApiKey: 'test-key',
                passwordExtraction: { extractedPassword: plaintext, looksLikeAPasswordAttempt: true },
            });
            const threadConfig = { configurable: { thread_id: 'scrum-108-password-question-mark' } };

            await advanceToCollectPassword(onboardingGraph, threadConfig);
            const result = await onboardingGraph.invoke(new Command({ resume: plaintext }), threadConfig);

            expect(result.step).toBe('COMPLETE');
            expect(result.collectedPasswordHash).toBeTruthy();
            expect(isInterrupted(result)).toBe(false);
        });
    });

    describe('masking (SCRUM-105 — password must never leak into messages or logs)', () => {
        const SECRET = 'Extremely-Secret-Value9';

        it('never adds the plaintext password to state.messages on the success path', async () => {
            const { onboardingGraph } = await loadGraphModule({
                openAiApiKey: 'test-key',
                passwordExtraction: { extractedPassword: SECRET, looksLikeAPasswordAttempt: true },
            });
            const threadConfig = { configurable: { thread_id: 'scrum-105-mask-messages-success' } };

            await advanceToCollectPassword(onboardingGraph, threadConfig);
            const final = await onboardingGraph.invoke(new Command({ resume: SECRET }), threadConfig);

            const messageText = final.messages.map((message) => String(message.content)).join(' | ');
            expect(messageText).not.toContain(SECRET);
        });

        it('never adds the plaintext password to state.messages on the abandonment path', async () => {
            const { onboardingGraph } = await loadGraphModule({
                openAiApiKey: 'test-key',
                passwordExtraction: { extractedPassword: '', looksLikeAPasswordAttempt: false },
            });
            const threadConfig = { configurable: { thread_id: 'scrum-105-mask-messages-abandon' } };

            await advanceToCollectPassword(onboardingGraph, threadConfig);
            await onboardingGraph.invoke(new Command({ resume: SECRET }), threadConfig);
            await onboardingGraph.invoke(new Command({ resume: SECRET }), threadConfig);
            const final = await onboardingGraph.invoke(new Command({ resume: SECRET }), threadConfig);

            const messageText = final.messages.map((message) => String(message.content)).join(' | ');
            expect(messageText).not.toContain(SECRET);
        });

        it('never passes the plaintext password to the logger when OPENAI_API_KEY is unset', async () => {
            const { onboardingGraph, logger } = await loadGraphModule({ openAiApiKey: undefined });
            const threadConfig = { configurable: { thread_id: 'scrum-105-mask-logger-fallback' } };

            await advanceToCollectPassword(onboardingGraph, threadConfig);
            await onboardingGraph.invoke(new Command({ resume: SECRET }), threadConfig);

            expect(logger.warn).toHaveBeenCalled();
            expect(allLoggedText(logger)).not.toContain(SECRET);
        });

        it('never passes the plaintext password to the logger when the model call fails', async () => {
            const { onboardingGraph, logger } = await loadGraphModule({ openAiApiKey: 'test-key', passwordExtraction: 'throw' });
            const threadConfig = { configurable: { thread_id: 'scrum-105-mask-logger-error' } };

            await advanceToCollectPassword(onboardingGraph, threadConfig);
            await onboardingGraph.invoke(new Command({ resume: SECRET }), threadConfig);

            expect(logger.error).toHaveBeenCalled();
            expect(allLoggedText(logger)).not.toContain(SECRET);
        });
    });
});

describe('onboarding graph full-cycle smoke test (SCRUM-100–105)', () => {
    it('walks GREETING → COLLECT_NAME → COLLECT_EMAIL → COLLECT_DOB → COLLECT_PASSWORD → END with all valid replies on the first attempt', async () => {
        const plaintextPassword = 'Correct-Horse-Battery9';
        const { onboardingGraph, greetingInvokeMock, nameInvokeMock, emailInvokeMock, dobInvokeMock, passwordInvokeMock } =
            await loadGraphModule({
                openAiApiKey: 'test-key',
                passwordExtraction: { extractedPassword: plaintextPassword, looksLikeAPasswordAttempt: true },
            });
        const threadConfig = { configurable: { thread_id: 'scrum-105-full-cycle' } };

        const afterGreeting = await onboardingGraph.invoke({}, threadConfig);
        expect(isInterrupted(afterGreeting)).toBe(true);

        const afterName = await onboardingGraph.invoke(new Command({ resume: 'John Smith' }), threadConfig);
        expect(isInterrupted(afterName)).toBe(true);

        const afterEmail = await onboardingGraph.invoke(new Command({ resume: 'john@example.com' }), threadConfig);
        expect(isInterrupted(afterEmail)).toBe(true);

        const afterDob = await onboardingGraph.invoke(new Command({ resume: VALID_DOB }), threadConfig);
        expect(isInterrupted(afterDob)).toBe(true);

        const final = await onboardingGraph.invoke(new Command({ resume: plaintextPassword }), threadConfig);

        expect(isInterrupted(final)).toBe(false);
        expect(final.step).toBe('COMPLETE');
        expect(final.collectedName).toBe('John Smith');
        expect(final.collectedEmail).toBe('john@example.com');
        expect(final.collectedDob).toBe(VALID_DOB);
        expect(final.collectedPasswordHash).toBeTruthy();
        expect(final.collectedPasswordHash).not.toBe(plaintextPassword);
        expect(final.lastValidationError).toBeNull();

        const messageText = final.messages.map((message) => String(message.content)).join(' | ');
        expect(messageText).not.toContain(plaintextPassword);

        expect(greetingInvokeMock).toHaveBeenCalledOnce();
        expect(nameInvokeMock).toHaveBeenCalledOnce();
        expect(emailInvokeMock).toHaveBeenCalledOnce();
        expect(dobInvokeMock).toHaveBeenCalledOnce();
        expect(passwordInvokeMock).toHaveBeenCalledOnce();
    });
});

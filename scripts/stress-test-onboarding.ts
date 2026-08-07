#!/usr/bin/env -S npx tsx
/**
 * Synthetic stress test: N concurrent chat-assisted onboarding sessions against
 * the week5 endpoints as asf0 actually implemented them on main (rule-based
 * state machine, see .specs/features/chat-assisted-registration/spec.md) — not
 * the LangGraph version, which is unwired architecture (see PR #70).
 *
 * Each simulated session:
 *   1. POST /chat/continue-session x3 (initial_greeting -> name_provided ->
 *      email_collection -> phone_collection). Content of `message` doesn't
 *      affect step advancement — advanceChat() in continue-session/route.ts is
 *      purely positional — but real-shaped replies are used anyway so latency
 *      and payload size resemble an actual client.
 *   2. Either POST /user/chat-assisted (completes registration, the default)
 *      or POST /escalate-registration (only with --with-escalations), per a
 *      deterministic per-session split so re-runs are comparable.
 *
 * A session only counts as "completed" if step 2 returns 201 (chat-assisted)
 * or 200 (escalate-registration); anything else — including a mid-conversation
 * failure — counts as failed and short-circuits the remaining steps for that
 * session.
 *
 * Usage:
 *   npx tsx scripts/stress-test-onboarding.ts
 *   API_URL=https://<render-app>.onrender.com npx tsx scripts/stress-test-onboarding.ts
 *   npx tsx scripts/stress-test-onboarding.ts --with-escalations         # 10% default
 *   npx tsx scripts/stress-test-onboarding.ts --with-escalations=25      # 25%
 *   npx tsx scripts/stress-test-onboarding.ts --sessions=100
 *
 * Env vars:
 *   API_URL             Base URL of the target deployment. Default: http://localhost:3000
 *                        (matches this repo's other scripts/CI jobs, e.g. week1-integration-test.yaml)
 *   REQUEST_TIMEOUT_MS   Per-request abort timeout. Default: 10000. Raise this against a
 *                        cold/small deployment (e.g. Render free tier) — a too-tight timeout
 *                        just reports "aborted" instead of the real (slow) latency.
 */

const DEFAULT_API_URL = 'http://localhost:3000';
const DEFAULT_SESSION_COUNT = 50;
const DEFAULT_ESCALATION_PERCENT = 10;
const REQUEST_TIMEOUT_MS = Number(process.env.REQUEST_TIMEOUT_MS) || 10_000;

type ChatStep = 'initial_greeting' | 'name_provided' | 'email_collection' | 'phone_collection';

type CliOptions = {
    apiUrl: string;
    sessionCount: number;
    escalationPercent: number; // 0 disables escalation entirely
};

function parseArgs(argv: string[]): CliOptions {
    let sessionCount = DEFAULT_SESSION_COUNT;
    let escalationPercent = 0;

    for (const arg of argv) {
        if (arg === '--with-escalations') {
            escalationPercent = DEFAULT_ESCALATION_PERCENT;
        } else if (arg.startsWith('--with-escalations=')) {
            escalationPercent = Number(arg.split('=')[1]);
        } else if (arg.startsWith('--sessions=')) {
            sessionCount = Number(arg.split('=')[1]);
        }
    }

    if (!Number.isFinite(sessionCount) || sessionCount <= 0) {
        throw new Error(`--sessions must be a positive number, got: ${sessionCount}`);
    }
    if (!Number.isFinite(escalationPercent) || escalationPercent < 0 || escalationPercent > 100) {
        throw new Error(`--with-escalations must be a number 0-100, got: ${escalationPercent}`);
    }

    return {
        apiUrl: (process.env.API_URL ?? DEFAULT_API_URL).replace(/\/+$/, ''),
        sessionCount,
        escalationPercent,
    };
}

type StepResult = {
    name: string;
    status: number | null;
    latencyMs: number;
    error?: string;
};

type SessionOutcome = 'completed' | 'escalated' | 'failed';

type SessionResult = {
    index: number;
    chatSessionId: string;
    outcome: SessionOutcome;
    failedAt?: string;
    steps: StepResult[];
};

async function timedFetch(url: string, body: unknown): Promise<{ status: number; json: unknown; latencyMs: number }> {
    const start = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
        const json = await response.json().catch(() => null);
        return { status: response.status, json, latencyMs: performance.now() - start };
    } finally {
        clearTimeout(timeout);
    }
}

/** Deterministic split: every Nth session (by 100/percent spacing) escalates instead of completing. */
function shouldEscalate(index: number, escalationPercent: number): boolean {
    if (escalationPercent <= 0) return false;
    const spacing = Math.round(100 / escalationPercent);
    return index % spacing === 0;
}

function buildFixture(index: number) {
    const runId = `${Date.now()}-${index}`;
    return {
        chatSessionId: `stress-${runId}`,
        email: `stress-test-${runId}@example.com`.toLowerCase(),
        firstName: 'Stress',
        lastName: `Tester${index}`,
        password: `StressTest!${index}`,
        birthDate: '1990-01-01',
        phoneNumber: '+15555550123',
    };
}

async function runSession(apiUrl: string, index: number, escalate: boolean): Promise<SessionResult> {
    const fixture = buildFixture(index);
    const steps: StepResult[] = [];

    const conversationTurns: Array<{ context?: ChatStep; message: string }> = [
        { message: "Hi! I'd like to create an account." },
        { context: 'name_provided', message: `${fixture.firstName} ${fixture.lastName}` },
        { context: 'email_collection', message: fixture.email },
    ];

    for (let turn = 0; turn < conversationTurns.length; turn++) {
        const { context, message } = conversationTurns[turn];
        const stepName = `continue-session[${turn + 1}]`;
        try {
            const { status, latencyMs } = await timedFetch(`${apiUrl}/chat/continue-session`, {
                chatSessionId: fixture.chatSessionId,
                message,
                ...(context ? { context } : {}),
            });
            steps.push({ name: stepName, status, latencyMs });
            if (status !== 200) {
                return { index, chatSessionId: fixture.chatSessionId, outcome: 'failed', failedAt: stepName, steps };
            }
        } catch (error) {
            steps.push({ name: stepName, status: null, latencyMs: NaN, error: (error as Error).message });
            return { index, chatSessionId: fixture.chatSessionId, outcome: 'failed', failedAt: stepName, steps };
        }
    }

    if (escalate) {
        try {
            const { status, latencyMs } = await timedFetch(`${apiUrl}/escalate-registration`, {
                chatSessionId: fixture.chatSessionId,
                phoneNumber: fixture.phoneNumber,
                issueType: 'confusion_about_process',
                responsePreference: 'chat',
            });
            steps.push({ name: 'escalate-registration', status, latencyMs });
            return {
                index,
                chatSessionId: fixture.chatSessionId,
                outcome: status === 200 ? 'escalated' : 'failed',
                failedAt: status === 200 ? undefined : 'escalate-registration',
                steps,
            };
        } catch (error) {
            steps.push({ name: 'escalate-registration', status: null, latencyMs: NaN, error: (error as Error).message });
            return { index, chatSessionId: fixture.chatSessionId, outcome: 'failed', failedAt: 'escalate-registration', steps };
        }
    }

    try {
        const { status, latencyMs } = await timedFetch(`${apiUrl}/user/chat-assisted`, {
            chatSessionId: fixture.chatSessionId,
            userData: {
                email: fixture.email,
                password: fixture.password,
                birthDate: fixture.birthDate,
                firstName: fixture.firstName,
                lastName: fixture.lastName,
            },
        });
        steps.push({ name: 'chat-assisted', status, latencyMs });
        return {
            index,
            chatSessionId: fixture.chatSessionId,
            outcome: status === 201 ? 'completed' : 'failed',
            failedAt: status === 201 ? undefined : 'chat-assisted',
            steps,
        };
    } catch (error) {
        steps.push({ name: 'chat-assisted', status: null, latencyMs: NaN, error: (error as Error).message });
        return { index, chatSessionId: fixture.chatSessionId, outcome: 'failed', failedAt: 'chat-assisted', steps };
    }
}

function percentile(sortedValues: number[], p: number): number | null {
    if (sortedValues.length === 0) return null;
    const index = Math.ceil((p / 100) * sortedValues.length) - 1;
    return sortedValues[Math.min(Math.max(index, 0), sortedValues.length - 1)];
}

function summarizeLatencies(label: string, latencies: number[]): void {
    const clean = latencies.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
    if (clean.length === 0) {
        console.log(`  ${label.padEnd(20)} no successful requests`);
        return;
    }
    const p50 = percentile(clean, 50)!.toFixed(0);
    const p95 = percentile(clean, 95)!.toFixed(0);
    const p99 = percentile(clean, 99)!.toFixed(0);
    const max = clean[clean.length - 1].toFixed(0);
    console.log(`  ${label.padEnd(20)} n=${clean.length.toString().padEnd(4)} p50=${p50}ms  p95=${p95}ms  p99=${p99}ms  max=${max}ms`);
}

async function main(): Promise<void> {
    const options = parseArgs(process.argv.slice(2));
    const escalationCount = options.escalationPercent > 0 ? Math.round((options.escalationPercent / 100) * options.sessionCount) : 0;

    console.log(`Stress test: onboarding via chat-assisted registration`);
    console.log(`  Target:      ${options.apiUrl}`);
    console.log(`  Sessions:    ${options.sessionCount} concurrent`);
    console.log(
        `  Escalations: ${escalationCount > 0 ? `~${escalationCount} (${options.escalationPercent}%)` : 'disabled (pass --with-escalations to enable)'}`
    );
    console.log('');

    const wallClockStart = performance.now();
    const results = await Promise.all(
        Array.from({ length: options.sessionCount }, (_, index) =>
            runSession(options.apiUrl, index, shouldEscalate(index, options.escalationPercent))
        )
    );
    const wallClockMs = performance.now() - wallClockStart;

    const completed = results.filter((r) => r.outcome === 'completed');
    const escalated = results.filter((r) => r.outcome === 'escalated');
    const failed = results.filter((r) => r.outcome === 'failed');

    console.log('Results');
    console.log(`  Completed:   ${completed.length}/${options.sessionCount}`);
    if (escalationCount > 0) {
        console.log(`  Escalated:   ${escalated.length}/${options.sessionCount}`);
    }
    console.log(`  Failed:      ${failed.length}/${options.sessionCount}`);
    console.log(`  Wall clock:  ${(wallClockMs / 1000).toFixed(2)}s`);
    console.log('');

    console.log('Latency by endpoint (successful requests only):');
    const byEndpoint = new Map<string, number[]>();
    for (const result of results) {
        for (const step of result.steps) {
            if (step.status === null) continue;
            const key = step.name.replace(/\[\d+\]$/, '');
            if (!byEndpoint.has(key)) byEndpoint.set(key, []);
            byEndpoint.get(key)!.push(step.latencyMs);
        }
    }
    for (const [endpoint, latencies] of byEndpoint) {
        summarizeLatencies(endpoint, latencies);
    }
    console.log('');

    if (failed.length > 0) {
        console.log('Failures:');
        const byFailurePoint = new Map<string, { count: number; statuses: Set<string> }>();
        for (const result of failed) {
            const key = result.failedAt ?? 'unknown';
            const lastStep = result.steps[result.steps.length - 1];
            const statusLabel = lastStep?.error ? `network error: ${lastStep.error}` : `HTTP ${lastStep?.status}`;
            if (!byFailurePoint.has(key)) byFailurePoint.set(key, { count: 0, statuses: new Set() });
            const entry = byFailurePoint.get(key)!;
            entry.count += 1;
            entry.statuses.add(statusLabel);
        }
        for (const [step, { count, statuses }] of byFailurePoint) {
            console.log(`  ${step}: ${count} session(s) — ${Array.from(statuses).join(', ')}`);
        }
        console.log('');
    }

    if (failed.length > 0) {
        process.exitCode = 1;
    }
}

main().catch((error) => {
    console.error('Stress test crashed:', error);
    process.exitCode = 1;
});

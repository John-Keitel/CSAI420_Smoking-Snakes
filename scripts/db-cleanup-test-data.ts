#!/usr/bin/env -S npx tsx
/**
 * Deletes leftover test data by pattern, connecting directly to Postgres via
 * Prisma — no HTTP, no dependency on any DELETE endpoint (notably not the
 * unauthenticated `DELETE /user/[userId]`, see GitHub issue #72). Built for
 * ticket 49: today, HTTP-based self-cleanup exists only in the week5 grading
 * suite's own `afterEach` (outside this repo), and it silently swallows
 * failures (try/catch just logs a warning), so orphaned test rows accumulate
 * across interrupted or partially-failed runs. This script is the backstop.
 *
 * Three independent passes, because only one of the three tables this
 * targets actually has a foreign key to User:
 *
 *   1. ChatRegistrationSession — no relation to User at all (keyed only by
 *      the caller-supplied chatSessionId). Matched and deleted on its own.
 *   2. Escalation — `userId`/`sessionId` are plain strings, explicitly
 *      commented in the schema as "opaque identifiers... not foreign keys".
 *      Matched and deleted on its own, via `sessionId` (shared with the
 *      older /escalate-question flow, so this match is reasonable but not
 *      guaranteed to be test-data-exclusive — flagged in the output).
 *   3. User — has real `onDelete: Cascade` foreign keys from Session,
 *      Assessment, Step, ExpoPushToken, and ChatSession (matched via
 *      customerEmail, cascading further to FlaggedSession/ChatMessage).
 *      Deleting matched User rows lets Postgres cascade the rest — no
 *      manual code needed for those tables.
 *
 * Dry-run by default: every pass runs as findMany, prints what it would
 * delete, and changes nothing. Pass --confirm to actually delete.
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/db-cleanup-test-data.ts
 *   DATABASE_URL=postgresql://... npx tsx scripts/db-cleanup-test-data.ts --confirm
 */

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../src/generated/prisma/client';

// mobile/app/lib/session.js, my own stress test (scripts/stress-test-onboarding.ts),
// and every weekN.test.js / chatTestHelpers.js in ~/week-4-integration-tests-ljm234
// and ~/week-5-integration-tests-ljm234 generate chatSessionId as `${prefix}${Date.now()}`.
const CHAT_SESSION_ID_PREFIXES = [
    'session_',
    'context_session_',
    'concurrent_session_',
    'email_test_',
    'password_test_',
    'simple_mode_',
    'intl_',
    'recovery_session_',
    'analytics_session_',
    'security_test_',
    'timeout_session_',
    'stress-',
];

// Same source files, matched against User.email instead.
const EMAIL_PREFIXES = [
    'test_',
    'stress-test-',
    'concurrent_',
    'chat_',
    'timeout_',
    'security_test_',
    'email_test_',
    'password_test_',
    'simple_',
    'international_',
    'test_intl_',
    'test_accessibility_',
    'recovery_',
    'analytics_',
    'incomplete_',
];

// Fixture accounts other test suites depend on being able to log in as, or
// reference by identity — deleting these breaks tests that did not create
// them and are not the ones running this script. Never touched, even if a
// future prefix would otherwise match.
const NEVER_DELETE_EMAILS = ['test_user@example.com', 'physician@stedi.com', 'developer@stedi.com', 'user@provider.com'];

// Hardcoded, non-timestamped test emails that are genuine leftover test data
// but don't carry any of the prefixes above.
const ALWAYS_DELETE_EMAILS = ['valid.email@example.com', 'failed_user@example.com'];

const SAMPLE_LIMIT = 10;

function maskDatabaseUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.protocol}//${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}${parsed.pathname}`;
    } catch {
        return '(unparseable DATABASE_URL)';
    }
}

function printSample(label: string, items: string[]): void {
    const shown = items.slice(0, SAMPLE_LIMIT);
    for (const item of shown) {
        console.log(`    - ${item}`);
    }
    if (items.length > shown.length) {
        console.log(`    ... and ${items.length - shown.length} more`);
    }
    if (items.length === 0) {
        console.log(`    (none)`);
    }
}

async function main(): Promise<void> {
    const confirm = process.argv.includes('--confirm');
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
        throw new Error('DATABASE_URL is not set.');
    }

    console.log(`Target database: ${maskDatabaseUrl(databaseUrl)}`);
    console.log(`Mode: ${confirm ? 'LIVE — rows will be deleted' : 'DRY RUN — nothing will be deleted (pass --confirm to actually delete)'}`);
    console.log('');

    const adapter = new PrismaPg({ connectionString: databaseUrl });
    const prisma = new PrismaClient({ adapter });

    try {
        // Pass 1: ChatRegistrationSession
        const chatSessionWhere = {
            OR: CHAT_SESSION_ID_PREFIXES.map((prefix) => ({ chatSessionId: { startsWith: prefix } })),
        };
        const chatSessionMatches = await prisma.chatRegistrationSession.findMany({
            where: chatSessionWhere,
            select: { chatSessionId: true },
        });

        console.log(`ChatRegistrationSession: ${chatSessionMatches.length} match(es) by chatSessionId prefix`);
        printSample(
            'chatSessionId',
            chatSessionMatches.map((row) => row.chatSessionId)
        );
        if (confirm && chatSessionMatches.length > 0) {
            const result = await prisma.chatRegistrationSession.deleteMany({ where: chatSessionWhere });
            console.log(`  Deleted ${result.count}.`);
        }
        console.log('');

        // Pass 2: Escalation
        const escalationWhere = {
            OR: CHAT_SESSION_ID_PREFIXES.map((prefix) => ({ sessionId: { startsWith: prefix } })),
        };
        const escalationMatches = await prisma.escalation.findMany({
            where: escalationWhere,
            select: { escalationId: true, sessionId: true },
        });

        console.log(`Escalation: ${escalationMatches.length} match(es) by sessionId prefix`);
        console.log(
            '  (sessionId is shared with the older /escalate-question flow — this match is reasonable, not guaranteed exclusive to test data)'
        );
        printSample(
            'escalationId',
            escalationMatches.map((row) => `${row.escalationId} (sessionId: ${row.sessionId})`)
        );
        if (confirm && escalationMatches.length > 0) {
            const result = await prisma.escalation.deleteMany({ where: escalationWhere });
            console.log(`  Deleted ${result.count}.`);
        }
        console.log('');

        // Pass 3: User (cascades to Session, Assessment, Step, ExpoPushToken,
        // ChatSession -> FlaggedSession/ChatMessage automatically via Postgres FK)
        const userWhere = {
            AND: [
                {
                    OR: [...EMAIL_PREFIXES.map((prefix) => ({ email: { startsWith: prefix } })), { email: { in: ALWAYS_DELETE_EMAILS } }],
                },
                { email: { notIn: NEVER_DELETE_EMAILS } },
            ],
        };
        const userMatches = await prisma.user.findMany({
            where: userWhere,
            select: { id: true, email: true },
        });

        console.log(`User: ${userMatches.length} match(es) by email prefix/include-list, excluding fixture accounts`);
        printSample(
            'email',
            userMatches.map((row) => row.email)
        );
        if (confirm && userMatches.length > 0) {
            const result = await prisma.user.deleteMany({ where: userWhere });
            console.log(
                `  Deleted ${result.count}. Session/Assessment/Step/ExpoPushToken/ChatSession rows for these users were cascade-deleted by Postgres, not counted separately.`
            );
        }
        console.log('');

        if (!confirm) {
            console.log('Dry run complete. Re-run with --confirm to actually delete the rows listed above.');
        } else {
            console.log('Cleanup complete.');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error('db-cleanup-test-data crashed:', error);
    process.exitCode = 1;
});

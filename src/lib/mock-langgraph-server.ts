import { randomUUID } from 'crypto';

export type MockLangGraphStep = 'COLLECT_NAME' | 'COLLECT_EMAIL' | 'COLLECT_DOB' | 'COMPLETE';

export type MockLangGraphMessage = {
    role: 'assistant' | 'user';
    content: string;
    createdAt: string;
};

export type MockLangGraphSession = {
    sessionId: string;
    step: MockLangGraphStep;
    collectedName: string | null;
    collectedEmail: string | null;
    collectedDob: string | null;
    transcript: MockLangGraphMessage[];
    updatedAt: string;
};

const sessions = new Map<string, MockLangGraphSession>();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toIsoNow(): string {
    return new Date().toISOString();
}

function pushMessage(session: MockLangGraphSession, role: MockLangGraphMessage['role'], content: string) {
    const now = toIsoNow();
    session.transcript.push({ role, content, createdAt: now });
    session.updatedAt = now;
}

function isValidDob(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime());
}

export function startMockLangGraphSession(entryPoint?: string): MockLangGraphSession {
    const sessionId = randomUUID();
    const session: MockLangGraphSession = {
        sessionId,
        step: 'COLLECT_NAME',
        collectedName: null,
        collectedEmail: null,
        collectedDob: null,
        transcript: [],
        updatedAt: toIsoNow(),
    };

    const kickoff =
        entryPoint?.trim() === 'need-help'
            ? 'Need Help selected. I can get you started. What is your full name?'
            : 'Welcome to onboarding. What is your full name?';
    pushMessage(session, 'assistant', kickoff);
    sessions.set(sessionId, session);

    return session;
}

export function getMockLangGraphSession(sessionId: string): MockLangGraphSession | null {
    return sessions.get(sessionId) ?? null;
}

export function resetMockLangGraphSessions() {
    sessions.clear();
}

export function advanceMockLangGraphSession(sessionId: string, message: string): MockLangGraphSession | null {
    const session = sessions.get(sessionId);
    if (!session) {
        return null;
    }

    const normalizedMessage = message.trim();
    pushMessage(session, 'user', normalizedMessage);

    if (session.step === 'COLLECT_NAME') {
        if (normalizedMessage.length < 2) {
            pushMessage(session, 'assistant', 'Name is too short. Please provide your full name.');
            return session;
        }

        session.collectedName = normalizedMessage;
        session.step = 'COLLECT_EMAIL';
        pushMessage(session, 'assistant', `Thanks ${normalizedMessage.split(' ')[0]}. What is your email address?`);
        return session;
    }

    if (session.step === 'COLLECT_EMAIL') {
        const candidate = normalizedMessage.toLowerCase();
        if (!EMAIL_REGEX.test(candidate)) {
            pushMessage(session, 'assistant', 'That does not look like a valid email. Please try again.');
            return session;
        }

        session.collectedEmail = candidate;
        session.step = 'COLLECT_DOB';
        pushMessage(session, 'assistant', 'Great. Please provide your birth date in YYYY-MM-DD format.');
        return session;
    }

    if (session.step === 'COLLECT_DOB') {
        if (!isValidDob(normalizedMessage)) {
            pushMessage(session, 'assistant', 'Date format must be YYYY-MM-DD. Please try again.');
            return session;
        }

        session.collectedDob = normalizedMessage;
        session.step = 'COMPLETE';
        pushMessage(session, 'assistant', 'Onboarding details captured. You can now submit registration.');
        return session;
    }

    pushMessage(session, 'assistant', 'This onboarding session is complete.');
    return session;
}

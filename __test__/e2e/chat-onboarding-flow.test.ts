import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type StoredUser = {
    id: string;
    name: string;
    email: string;
    password: string;
    dob: Date;
};

type BackendHarness = {
    resetMockSessionServer: () => Promise<void>;
    startMockSession: (entryPoint: 'need-help' | 'default') => Promise<{ sessionId: string; step: string }>;
    sendMockMessage: (
        sessionId: string,
        message: string
    ) => Promise<{ sessionId: string; step: string; transcript: Array<{ role: string; content: string }> }>;
    getMockSession: (sessionId: string) => Promise<{ sessionId: string; step: string; transcript: Array<{ role: string; content: string }> }>;
    registerChatUser: (payload: { name: string; email: string; password: string; dob: string }) => Promise<{ status: number; body: unknown }>;
    listUsers: () => StoredUser[];
};

class MockReactNativeClient {
    private readonly backend: BackendHarness;
    private activeSessionId: string | null = null;

    constructor(backend: BackendHarness) {
        this.backend = backend;
    }

    get sessionId(): string | null {
        return this.activeSessionId;
    }

    async tapNeedHelp(): Promise<{ sessionId: string; step: string }> {
        const session = await this.backend.startMockSession('need-help');
        this.activeSessionId = session.sessionId;
        return session;
    }

    async sendChatMessage(message: string) {
        if (!this.activeSessionId) {
            throw new Error('No active session. tapNeedHelp() must be called first.');
        }

        return this.backend.sendMockMessage(this.activeSessionId, message);
    }

    async recoverChatSession(sessionId: string) {
        const recovered = await this.backend.getMockSession(sessionId);
        this.activeSessionId = recovered.sessionId;
        return recovered;
    }

    async submitRegistration(payload: { name: string; email: string; password: string; dob: string }) {
        return this.backend.registerChatUser(payload);
    }
}

async function createBackendHarness(initialUsers: StoredUser[] = []): Promise<BackendHarness> {
    vi.resetModules();

    const usersByEmail = new Map<string, StoredUser>(initialUsers.map((user) => [user.email, user]));

    const findUniqueMock = vi.fn(async ({ where }: { where: { email: string } }) => {
        const user = usersByEmail.get(where.email);
        return user ? { id: user.id } : null;
    });

    const createUserMock = vi.fn(async ({ data, select }: { data: Omit<StoredUser, 'id'>; select: Record<string, boolean> }) => {
        const id = `user-${usersByEmail.size + 1}`;
        const stored: StoredUser = {
            id,
            name: data.name,
            email: data.email,
            password: data.password,
            dob: data.dob,
        };

        usersByEmail.set(stored.email, stored);

        const selected: Record<string, unknown> = {};
        for (const [key, enabled] of Object.entries(select)) {
            if (enabled) {
                selected[key] = (stored as Record<string, unknown>)[key];
            }
        }

        return selected;
    });

    vi.doMock('@/lib/db', () => ({
        prisma: {
            user: {
                findUnique: findUniqueMock,
                create: createUserMock,
            },
        },
    }));

    vi.doMock('bcrypt', () => ({
        default: {
            hash: vi.fn(async (value: string) => `hashed:${value}`),
        },
    }));

    const registerRoute = await import('@/app/api/user/register-chat/route');
    const startSessionRoute = await import('@/app/api/mock/langgraph/session/route');
    const sessionRoute = await import('@/app/api/mock/langgraph/session/[sessionId]/route');
    const messageRoute = await import('@/app/api/mock/langgraph/session/[sessionId]/message/route');
    const resetRoute = await import('@/app/api/mock/langgraph/reset/route');

    return {
        resetMockSessionServer: async () => {
            await resetRoute.POST();
        },
        startMockSession: async (entryPoint: 'need-help' | 'default') => {
            const request = new NextRequest('http://localhost/api/mock/langgraph/session', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ entryPoint }),
            });
            const response = await startSessionRoute.POST(request);
            return response.json();
        },
        sendMockMessage: async (sessionId: string, message: string) => {
            const request = new NextRequest(`http://localhost/api/mock/langgraph/session/${sessionId}/message`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ message }),
            });
            const response = await messageRoute.POST(request, { params: Promise.resolve({ sessionId }) });
            return response.json();
        },
        getMockSession: async (sessionId: string) => {
            const response = await sessionRoute.GET(new Request(`http://localhost/api/mock/langgraph/session/${sessionId}`), {
                params: Promise.resolve({ sessionId }),
            });
            return response.json();
        },
        registerChatUser: async (payload: { name: string; email: string; password: string; dob: string }) => {
            const request = new NextRequest('http://localhost/api/user/register-chat', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const response = await registerRoute.POST(request);

            return {
                status: response.status,
                body: await response.json(),
            };
        },
        listUsers: () => Array.from(usersByEmail.values()),
    };
}

describe('React Native onboarding chat E2E suite (Vitest)', () => {
    let backend: BackendHarness;

    beforeEach(async () => {
        backend = await createBackendHarness();
        await backend.resetMockSessionServer();
    });

    it('Task 43: complete happy path (Need Help -> Chat -> DB user created)', async () => {
        const app = new MockReactNativeClient(backend);

        const started = await app.tapNeedHelp();
        expect(started.step).toBe('COLLECT_NAME');

        await app.sendChatMessage('Alex Johnson');
        await app.sendChatMessage('alex@example.com');
        const completion = await app.sendChatMessage('1990-06-15');

        expect(completion.step).toBe('COMPLETE');

        const registration = await app.submitRegistration({
            name: 'Alex Johnson',
            email: 'alex@example.com',
            password: 'Password123',
            dob: '1990-06-15',
        });

        expect(registration.status).toBe(201);
        const registrationBody = registration.body as { success: boolean; data: { email: string } };
        expect(registrationBody.success).toBe(true);
        expect(registrationBody.data.email).toBe('alex@example.com');

        const users = backend.listUsers();
        expect(users).toHaveLength(1);
        expect(users[0]?.email).toBe('alex@example.com');
        expect(users[0]?.password).toBe('hashed:Password123');
    });

    it('Task 44: handles duplicate email conflict during chat session', async () => {
        backend = await createBackendHarness([
            {
                id: 'seed-1',
                name: 'Existing User',
                email: 'existing@example.com',
                password: 'hashed:SeedPassword',
                dob: new Date('1988-03-12T00:00:00.000Z'),
            },
        ]);
        await backend.resetMockSessionServer();

        const app = new MockReactNativeClient(backend);
        const started = await app.tapNeedHelp();

        await app.sendChatMessage('Jamie Carter');
        await app.sendChatMessage('existing@example.com');
        await app.sendChatMessage('1992-01-20');

        const conflict = await app.submitRegistration({
            name: 'Jamie Carter',
            email: 'existing@example.com',
            password: 'Password123',
            dob: '1992-01-20',
        });

        expect(conflict.status).toBe(409);
        expect(conflict.body).toEqual({ error: 'Email already registered' });

        const recovered = await app.recoverChatSession(started.sessionId);
        expect(recovered.sessionId).toBe(started.sessionId);
        expect(recovered.step).toBe('COMPLETE');
        expect(recovered.transcript.length).toBeGreaterThan(0);
    });

    it('Task 45: supports mid-conversation drop-off and session recovery', async () => {
        const appA = new MockReactNativeClient(backend);

        const started = await appA.tapNeedHelp();
        await appA.sendChatMessage('Morgan Lee');

        const appB = new MockReactNativeClient(backend);
        const recovered = await appB.recoverChatSession(started.sessionId);

        expect(recovered.sessionId).toBe(started.sessionId);
        expect(recovered.step).toBe('COLLECT_EMAIL');
        expect(recovered.transcript.some((message) => message.content.includes('Morgan'))).toBe(true);

        await appB.sendChatMessage('morgan@example.com');
        const completion = await appB.sendChatMessage('1985-11-03');

        expect(completion.step).toBe('COMPLETE');
    });
});

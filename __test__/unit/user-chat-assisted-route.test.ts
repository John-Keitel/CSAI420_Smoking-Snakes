import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { HttpException } from '@/lib/http';

const { loggerMock, createChatAssistedUserMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    createChatAssistedUserMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

// Mock only the repository leaf module (the one that imports @/lib/db) — schemas.ts and
// session-timeout.ts don't touch Prisma/ENV_VARS, so the real barrel (index.ts) can still
// import them unmocked and the route's validation/timeout logic runs for real.
vi.mock('@/lib/chat-registration/repository', () => ({ createChatAssistedUser: createChatAssistedUserMock }));

import { POST } from '@/app/user/chat-assisted/route';

const validUserData = {
    email: 'chat_user@example.com',
    password: 'Str0ngP@ssw0rd!',
    birthDate: '1990-01-01',
    phone: '8014567890',
    firstName: 'ChatBot',
    lastName: 'TestUser',
};

const fakeUser = {
    id: 'user_cuid_123',
    email: validUserData.email,
    firstName: validUserData.firstName,
    lastName: validUserData.lastName,
    phone: validUserData.phone,
    dateOfBirth: new Date(validUserData.birthDate),
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/user/chat-assisted', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

describe('POST /user/chat-assisted', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        // Reflects the args it was called with (email/firstName/lastName in particular) so
        // assertions on the 201 response body can check pass-through, not just a fixed fixture.
        createChatAssistedUserMock.mockImplementation(async (args: Record<string, unknown>) => ({
            ...fakeUser,
            ...args,
        }));
    });

    it('creates a user and returns the expected 201 shape', async () => {
        const response = await POST(
            buildRequest({
                userData: validUserData,
                chatSessionId: 'session_123',
                conversationLog: [
                    { role: 'assistant', message: "Hi! I'll help you create your STEDI account." },
                    { role: 'user', message: 'I need help signing up' },
                ],
            })
        );
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(body).toHaveProperty('user');
        expect(body).toHaveProperty('message');
        expect(body.message).toContain('chat assistant');
        expect(body.user.email).toBe(validUserData.email);
        expect(createChatAssistedUserMock).toHaveBeenCalledWith(
            expect.objectContaining({
                email: validUserData.email,
                firstName: validUserData.firstName,
                lastName: validUserData.lastName,
            })
        );
    });

    it('returns 400 with requiresChat when userData has multiple invalid fields', async () => {
        const response = await POST(
            buildRequest({
                userData: {
                    email: 'invalid-email-format',
                    password: 'weak',
                    birthDate: 'invalid-date',
                    phone: '123',
                    firstName: '',
                    lastName: 'TestUser',
                },
                chatSessionId: 'session_456',
                conversationLog: [],
            })
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(Array.isArray(body.errors)).toBe(true);
        expect(body.errors.length).toBeGreaterThan(0);
        expect(body.requiresChat).toBe(true);
        expect(createChatAssistedUserMock).not.toHaveBeenCalled();
    });

    it('returns 400 when required userData fields are missing', async () => {
        const response = await POST(
            buildRequest({
                userData: { email: 'incomplete@example.com' },
                chatSessionId: 'session_789',
            })
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toHaveProperty('errors');
        expect(body.requiresChat).toBe(true);
        expect(createChatAssistedUserMock).not.toHaveBeenCalled();
    });

    it('returns 400 when the body has no userData at all', async () => {
        const response = await POST(buildRequest({ invalidField: 'This should cause an error' }));

        expect(response.status).toBe(400);
        expect(createChatAssistedUserMock).not.toHaveBeenCalled();
    });

    it('returns 408 for a stale lastActivity, even with incomplete userData', async () => {
        const response = await POST(
            buildRequest({
                chatSessionId: 'timeout_session_1',
                lastActivity: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
                userData: {
                    email: 'timeout@example.com',
                    password: validUserData.password,
                    birthDate: validUserData.birthDate,
                    // firstName/lastName deliberately omitted
                },
            })
        );
        const body = await response.json();

        expect(response.status).toBe(408);
        expect(body.message).toContain('session');
        expect(createChatAssistedUserMock).not.toHaveBeenCalled();
    });

    it('does not short-circuit on a recent lastActivity', async () => {
        const response = await POST(
            buildRequest({
                chatSessionId: 'active_session_1',
                lastActivity: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                userData: validUserData,
            })
        );

        expect(response.status).toBe(201);
        expect(createChatAssistedUserMock).toHaveBeenCalledTimes(1);
    });

    it('rejects HTML/SQL-metacharacter-flavored names instead of sanitizing them', async () => {
        const response = await POST(
            buildRequest({
                userData: {
                    ...validUserData,
                    email: 'security_test@example.com',
                    firstName: '<script>alert("xss")</script>',
                    lastName: 'DROP TABLE users;--',
                },
                chatSessionId: 'security_test_1',
            })
        );

        expect([201, 400]).toContain(response.status);
        expect(response.status).toBe(400);
        expect(createChatAssistedUserMock).not.toHaveBeenCalled();
    });

    it.each([
        ['valid.email@example.com', true],
        ['invalid-email', false],
        ['missing-at-symbol.com', false],
        ['@missing-local-part.com', false],
        ['spaces in@email.com', false],
    ])('email %s is accepted=%s', async (email, shouldPass) => {
        const response = await POST(
            buildRequest({
                userData: { ...validUserData, email },
                chatSessionId: `email_test_${email}`,
            })
        );

        expect(response.status).toBe(shouldPass ? 201 : 400);
    });

    it.each([
        ['Str0ngP@ssw0rd!', true],
        ['weak', false],
        ['12345678', false],
        ['NoNumbers!', false],
        ['nonumbers123', false],
    ])('password %s shouldPass=%s', async (password, shouldPass) => {
        // The email local-part can't safely embed the raw password (it may contain "@"/"!"),
        // so it's derived by stripping non-alphanumerics rather than interpolated directly.
        const emailToken = password.replace(/[^a-zA-Z0-9]/g, '') || 'blank';
        const response = await POST(
            buildRequest({
                userData: { ...validUserData, email: `password_test_${emailToken}@example.com`, password },
                chatSessionId: `password_test_${emailToken}`,
            })
        );
        const body = await response.json();

        expect(response.status).toBe(shouldPass ? 201 : 400);
        if (!shouldPass) {
            expect(body.errors.some((error: string) => error.toLowerCase().includes('password'))).toBe(true);
        }
    });

    it('accepts international characters in first/last name', async () => {
        const response = await POST(
            buildRequest({
                userData: {
                    ...validUserData,
                    email: 'international@example.com',
                    firstName: 'José María',
                    lastName: 'García-López',
                },
                chatSessionId: 'intl_1',
                locale: 'es-ES',
            })
        );
        const body = await response.json();

        expect(response.status).toBe(201);
        expect(createChatAssistedUserMock).toHaveBeenCalledWith(expect.objectContaining({ firstName: 'José María', lastName: 'García-López' }));
        expect(body.user.email).toBe('international@example.com');
    });

    it('tolerates accessibilityMode and sessionMetrics without failing validation', async () => {
        const response = await POST(
            buildRequest({
                userData: validUserData,
                chatSessionId: 'simple_mode_1',
                accessibilityMode: 'simplified_language',
                sessionMetrics: {
                    startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
                    endTime: new Date().toISOString(),
                    messageCount: 4,
                    userSatisfaction: 'high',
                },
            })
        );

        expect(response.status).toBe(201);
    });

    it('maps a duplicate-email HttpException from the repository to its status', async () => {
        createChatAssistedUserMock.mockRejectedValue(new HttpException(409, 'email is taken'));

        const response = await POST(buildRequest({ userData: validUserData, chatSessionId: 'dup_1' }));
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe('email is taken');
    });
});

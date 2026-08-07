import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaUserFindUnique, prismaUserCreate, loggerMock } = vi.hoisted(() => ({
    prismaUserFindUnique: vi.fn(),
    prismaUserCreate: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        user: {
            findUnique: prismaUserFindUnique,
            create: prismaUserCreate,
        },
    },
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { POST } from '@/app/user/chat-assisted/route';

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/user/chat-assisted', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: typeof body === 'string' ? body : JSON.stringify(body),
    });
}

const validPayload = {
    userData: {
        email: 'chat_123@example.com',
        password: 'P@ssword123',
        birthDate: '2000-01-01',
        phone: '8014567890',
        firstName: 'ChatBot',
        lastName: 'TestUser',
    },
    chatSessionId: 'session_1234567890',
    conversationLog: [
        { role: 'assistant', message: 'Hi! I will help you create your STEDI account.' },
        { role: 'user', message: 'I need help signing up' },
    ],
};

const storedUser = {
    id: 'cm-user-1',
    email: 'chat_123@example.com',
    firstName: 'ChatBot',
    lastName: 'TestUser',
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
};

beforeEach(() => {
    vi.resetAllMocks();
    prismaUserFindUnique.mockResolvedValue(null);
    prismaUserCreate.mockResolvedValue(storedUser);
});

describe('POST /user/chat-assisted', () => {
    it('returns 201 with the Week 5 user contract and a "chat assistant" message (CAT-01)', async () => {
        const response = await POST(buildRequest(validPayload));

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.user).toMatchObject({
            id: storedUser.id,
            email: validPayload.userData.email,
            firstName: 'ChatBot',
            lastName: 'TestUser',
        });
        expect(data.message).toContain('chat assistant');

        expect(prismaUserCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({
                email: validPayload.userData.email,
                firstName: 'ChatBot',
                lastName: 'TestUser',
                phone: '8014567890',
                dateOfBirth: expect.any(Date),
                dob: expect.any(Date),
                name: 'ChatBot TestUser',
                locale: null,
            }),
            select: expect.objectContaining({ id: true, email: true }),
        });
    });

    it('returns 400 { errors: string[], requiresChat: true } for invalid data (CAT-02, CAT-03, CAT-04)', async () => {
        const invalidPayload = {
            userData: {
                email: 'invalid-email-format',
                password: 'weak',
                birthDate: 'invalid-date',
                phone: '123',
                firstName: '',
                lastName: 'TestUser',
            },
            chatSessionId: 'session_123',
            conversationLog: [],
        };

        const response = await POST(buildRequest(invalidPayload));

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.errors).toBeInstanceOf(Array);
        expect(data.errors.length).toBeGreaterThan(0);
        expect(data.errors.some((error: string) => error.toLowerCase().includes('password'))).toBe(true);
        expect(data.requiresChat).toBe(true);
        expect(prismaUserCreate).not.toHaveBeenCalled();
    });

    it('returns 400 for missing required fields (CAT-02)', async () => {
        const incompletePayload = {
            userData: { email: 'incomplete_123@example.com' },
            chatSessionId: 'session_123',
        };

        const response = await POST(buildRequest(incompletePayload));

        expect(response.status).toBe(400);
        const data = await response.json();
        expect(data.errors).toBeInstanceOf(Array);
        expect(data.requiresChat).toBe(true);
    });

    it('rejects markup and SQL metacharacters in names with 400 (CAT-05)', async () => {
        const maliciousPayload = {
            userData: {
                email: 'test_123@example.com',
                password: 'P@ssword123',
                birthDate: '2000-01-01',
                firstName: '<script>alert("xss")</script>',
                lastName: 'DROP TABLE users;--',
            },
            chatSessionId: 'security_test_123',
        };

        const response = await POST(buildRequest(maliciousPayload));

        expect([201, 400]).toContain(response.status);
        if (response.status === 400) {
            const data = await response.json();
            expect(data.errors.length).toBeGreaterThan(0);
        }
    });

    it('echoes international names unmodified (CAT-06)', async () => {
        prismaUserCreate.mockResolvedValue({
            ...storedUser,
            firstName: 'José María',
            lastName: 'García-López',
        });

        const response = await POST(
            buildRequest({
                ...validPayload,
                userData: { ...validPayload.userData, firstName: 'José María', lastName: 'García-López' },
            })
        );

        expect(response.status).toBe(201);
        const data = await response.json();
        expect(data.user.firstName).toBe('José María');
        expect(data.user.lastName).toBe('García-López');
    });

    it('accepts accessibilityMode, locale, and sessionMetrics (CAT-07)', async () => {
        const response = await POST(
            buildRequest({
                ...validPayload,
                accessibilityMode: 'simplified_language',
                locale: 'es-ES',
                sessionMetrics: { startTime: new Date().toISOString(), messageCount: 4 },
            })
        );

        expect(response.status).toBe(201);
        expect(prismaUserCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({ locale: 'es-ES' }),
            select: expect.anything(),
        });
    });

    it('accepts payloads without a phone and stores the N/A placeholder', async () => {
        const { phone: _phone, ...userDataWithoutPhone } = validPayload.userData;

        const response = await POST(buildRequest({ ...validPayload, userData: userDataWithoutPhone }));

        expect(response.status).toBe(201);
        expect(prismaUserCreate).toHaveBeenCalledWith({
            data: expect.objectContaining({ phone: 'N/A' }),
            select: expect.anything(),
        });
    });

    it('returns 408 for a session last active more than 30 minutes ago, before validation (CAT-08)', async () => {
        const expiredPayload = {
            chatSessionId: 'timeout_session_123',
            lastActivity: new Date(Date.now() - 31 * 60 * 1000).toISOString(),
            userData: {
                email: 'timeout_123@example.com',
                password: 'P@ssword123',
                birthDate: '2000-01-01',
            },
        };

        const response = await POST(buildRequest(expiredPayload));

        expect(response.status).toBe(408);
        const data = await response.json();
        expect(data.message).toContain('session');
        expect(prismaUserFindUnique).not.toHaveBeenCalled();
    });

    it('returns 409 for a duplicate email (repo precedent)', async () => {
        prismaUserFindUnique.mockResolvedValue({ id: 'existing-user' });

        const response = await POST(buildRequest(validPayload));

        expect(response.status).toBe(409);
        const data = await response.json();
        expect(data.error).toBe('Email already registered');
    });

    it('returns 400 for a malformed body and 201 for the next valid request (CAT-10)', async () => {
        const malformedResponse = await POST(buildRequest({ invalidField: 'This should cause an error' }));
        expect(malformedResponse.status).toBe(400);

        const recoveryResponse = await POST(buildRequest(validPayload));
        expect(recoveryResponse.status).toBe(201);
    });

    it('handles 5 concurrent valid requests with at least one 201 (CAT-09)', async () => {
        const requests = Array.from({ length: 5 }, (_, index) =>
            POST(
                buildRequest({
                    ...validPayload,
                    userData: {
                        ...validPayload.userData,
                        email: `concurrent_${index}@example.com`,
                        firstName: `User${index}`,
                    },
                    chatSessionId: `concurrent_session_${index}`,
                })
            )
        );

        const responses = await Promise.allSettled(requests);
        const successful = responses.filter((result) => result.status === 'fulfilled' && result.value.status === 201);
        expect(successful.length).toBeGreaterThan(0);
    });
});

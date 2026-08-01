import { jwtVerify } from 'jose';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock, createMock, loggerMock } = vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    createMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('@/lib/env-vars', () => ({
    ENV_VARS: {
        AUTH_SECRET: 'test-auth-secret',
    },
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        user: {
            findUnique: findUniqueMock,
            create: createMock,
        },
    },
}));

vi.mock('@/lib/logger', () => ({
    getAppLogger: () => loggerMock,
}));

import { POST } from '@/app/api/user/register-chat/route';

function buildRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/user/register-chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('POST /api/user/register-chat integration', () => {
    beforeEach(() => {
        vi.clearAllMocks();

        findUniqueMock.mockResolvedValue(null);
        createMock.mockImplementation(async ({ data }: { data: { name: string; email: string } }) => ({
            id: 'user-123',
            name: data.name,
            email: data.email,
        }));
    });

    it('returns 201 with JWT token and sanitized user data for valid payload', async () => {
        const response = await POST(
            buildRequest({
                name: '  <b>Maria   Silva</b>  ',
                email: '  MARIA@STEDI.COM ',
                password: 'safePassword123',
                dob: '1993-06-20',
            })
        );

        expect(response.status).toBe(201);

        const body = (await response.json()) as {
            success: boolean;
            token: string;
            data: { id: string; name: string; email: string };
        };

        expect(body.success).toBe(true);
        expect(body.data).toEqual({
            id: 'user-123',
            name: 'Maria Silva',
            email: 'maria@stedi.com',
        });
        expect(body.token.split('.')).toHaveLength(3);

        const verified = await jwtVerify(body.token, new TextEncoder().encode('test-auth-secret'));
        expect(verified.payload.userId).toBe('user-123');
        expect(verified.payload.email).toBe('maria@stedi.com');

        expect(createMock).toHaveBeenCalledOnce();
        const createdPassword = createMock.mock.calls[0][0].data.password as string;
        expect(createdPassword).toEqual(expect.any(String));
        expect(createdPassword).not.toBe('safePassword123');
    });

    it('returns 409 when email is already registered', async () => {
        findUniqueMock.mockResolvedValue({ id: 'existing-user' });

        const response = await POST(
            buildRequest({
                name: 'Maria Silva',
                email: 'maria@stedi.com',
                password: 'safePassword123',
                dob: '1993-06-20',
            })
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({ error: 'Email already registered' });

        expect(createMock).not.toHaveBeenCalled();
    });

    it('returns 422 for malicious XSS payload', async () => {
        const response = await POST(
            buildRequest({
                name: '<script>alert(1)</script>',
                email: 'xss@stedi.com',
                password: 'safePassword123',
                dob: '1993-06-20',
            })
        );

        expect(response.status).toBe(422);
        const body = (await response.json()) as { message: string; errors: Record<string, string[]> };
        expect(body.message).toBe('validation error');
        expect(body.errors.name).toEqual(expect.any(Array));

        expect(findUniqueMock).not.toHaveBeenCalled();
        expect(createMock).not.toHaveBeenCalled();
    });
});

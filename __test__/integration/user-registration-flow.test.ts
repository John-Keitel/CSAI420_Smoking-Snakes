import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findUniqueMock, createMock, signUserTokenMock, loggerMock } = vi.hoisted(() => ({
    findUniqueMock: vi.fn(),
    createMock: vi.fn(),
    signUserTokenMock: vi.fn(),
    loggerMock: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
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

vi.mock('@/lib/auth', () => ({
    signUserToken: signUserTokenMock,
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

describe('POST /api/user/register-chat integration flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        findUniqueMock.mockResolvedValue(null);
        createMock.mockResolvedValue({
            id: 'user-1',
            name: 'Maria Silva',
            email: 'maria@stedi.com',
        });
        signUserTokenMock.mockReturnValue('jwt.token.mocked');
    });

    it('returns 201 with token and created user on valid registration', async () => {
        const response = await POST(
            buildRequest({
                name: 'Maria Silva',
                email: 'maria@stedi.com',
                password: 'safePassword123',
                dob: '1990-05-18',
            })
        );

        expect(response.status).toBe(201);
        await expect(response.json()).resolves.toEqual({
            success: true,
            token: 'jwt.token.mocked',
            data: {
                id: 'user-1',
                name: 'Maria Silva',
                email: 'maria@stedi.com',
            },
        });

        expect(findUniqueMock).toHaveBeenCalledWith({
            where: { email: 'maria@stedi.com' },
            select: { id: true },
        });
        expect(createMock).toHaveBeenCalledOnce();

        const createData = createMock.mock.calls[0][0].data;
        expect(createData.password).toEqual(expect.any(String));
        expect(createData.password).not.toBe('safePassword123');
        expect(createData.password.startsWith('$2')).toBe(true);

        expect(signUserTokenMock).toHaveBeenCalledWith({
            userId: 'user-1',
            email: 'maria@stedi.com',
        });
    });

    it('returns 409 when email is already registered', async () => {
        findUniqueMock.mockResolvedValue({ id: 'existing-user-1' });

        const response = await POST(
            buildRequest({
                name: 'Maria Silva',
                email: 'maria@stedi.com',
                password: 'safePassword123',
                dob: '1990-05-18',
            })
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            success: false,
            error: 'Email already registered',
            statusCode: 409,
        });

        expect(createMock).not.toHaveBeenCalled();
        expect(signUserTokenMock).not.toHaveBeenCalled();
    });

    it('returns 422 when XSS payload is sanitized into invalid input', async () => {
        const response = await POST(
            buildRequest({
                name: '<script>alert(1)</script>',
                email: 'xss@stedi.com',
                password: 'safePassword123',
                dob: '1990-05-18',
            })
        );

        expect(response.status).toBe(422);
        const body = (await response.json()) as {
            success: boolean;
            error: string;
            statusCode: number;
        };

        expect(body.success).toBe(false);
        expect(body.statusCode).toBe(422);
        expect(body.error).toContain('validation error');

        expect(findUniqueMock).not.toHaveBeenCalled();
        expect(createMock).not.toHaveBeenCalled();
        expect(signUserTokenMock).not.toHaveBeenCalled();
    });
});

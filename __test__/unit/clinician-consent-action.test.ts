import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock, prismaMock, validateSessionMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    prismaMock: {
        clinicianAccessRequest: {
            findUnique: vi.fn(),
            updateMany: vi.fn(),
        },
    },
    validateSessionMock: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
vi.mock('@/lib/auth/suresteps', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth/suresteps')>('@/lib/auth/suresteps');
    return {
        ...actual,
        validateSureStepsSession: validateSessionMock,
    };
});

import { POST } from '@/app/api/mobile/consent/action/route';

const sessionHeaders = {
    'suresteps.session.token': 'legacy-session-token',
};

function buildRequest(body: unknown) {
    return new NextRequest('http://localhost/api/mobile/consent/action', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            ...sessionHeaders,
        },
        body: JSON.stringify(body),
    });
}

describe('POST /api/mobile/consent/action', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        validateSessionMock.mockReturnValue({ ok: true, user: { id: 'user-1', email: 'patient@example.com', type: 'patient' } });
    });

    it('applies an atomic transition from PENDING to APPROVED', async () => {
        prismaMock.clinicianAccessRequest.findUnique.mockResolvedValue({
            id: 'request-1',
            customerEmail: 'patient@example.com',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        prismaMock.clinicianAccessRequest.updateMany.mockResolvedValue({ count: 1 });

        const response = await POST(buildRequest({ requestId: 'request-1', action: 'APPROVE' }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ requestId: 'request-1', status: 'APPROVED' });
        expect(prismaMock.clinicianAccessRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'request-1',
                    customerEmail: 'patient@example.com',
                    status: 'PENDING',
                }),
                data: expect.objectContaining({
                    status: 'APPROVED',
                    accessToken: expect.any(String),
                    tokenExpiresAt: expect.any(Date),
                }),
            })
        );
    });

    it('applies an atomic transition from PENDING to DENIED', async () => {
        prismaMock.clinicianAccessRequest.findUnique.mockResolvedValue({
            id: 'request-2',
            customerEmail: 'patient@example.com',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });
        prismaMock.clinicianAccessRequest.updateMany.mockResolvedValue({ count: 1 });

        const response = await POST(buildRequest({ requestId: 'request-2', action: 'DENY' }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({ requestId: 'request-2', status: 'DENIED' });
        expect(prismaMock.clinicianAccessRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    id: 'request-2',
                    customerEmail: 'patient@example.com',
                    status: 'PENDING',
                }),
                data: {
                    status: 'DENIED',
                    accessToken: null,
                    tokenExpiresAt: null,
                },
            })
        );
    });

    it('blocks updates for already-processed requests (422)', async () => {
        prismaMock.clinicianAccessRequest.findUnique.mockResolvedValue({
            id: 'request-3',
            customerEmail: 'patient@example.com',
            status: 'APPROVED',
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const response = await POST(buildRequest({ requestId: 'request-3', action: 'DENY' }));

        expect(response.status).toBe(422);
        expect(prismaMock.clinicianAccessRequest.updateMany).not.toHaveBeenCalled();
    });

    it('blocks updates for expired requests and atomically marks them as EXPIRED (422)', async () => {
        prismaMock.clinicianAccessRequest.findUnique.mockResolvedValue({
            id: 'request-4',
            customerEmail: 'patient@example.com',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
            expiresAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        });
        prismaMock.clinicianAccessRequest.updateMany.mockResolvedValue({ count: 1 });

        const response = await POST(buildRequest({ requestId: 'request-4', action: 'APPROVE' }));

        expect(response.status).toBe(422);
        expect(prismaMock.clinicianAccessRequest.updateMany).toHaveBeenCalledWith(
            expect.objectContaining({
                where: {
                    id: 'request-4',
                    customerEmail: 'patient@example.com',
                    status: 'PENDING',
                },
                data: {
                    status: 'EXPIRED',
                },
            })
        );
    });

    it('rejects unauthenticated access (401)', async () => {
        validateSessionMock.mockReturnValue({ ok: false, reason: 'Missing suresteps.session.token header' });

        const response = await POST(buildRequest({ requestId: 'request-5', action: 'APPROVE' }));

        expect(response.status).toBe(401);
        expect(prismaMock.clinicianAccessRequest.findUnique).not.toHaveBeenCalled();
    });

    it('rejects third-party tampering attempts (403)', async () => {
        prismaMock.clinicianAccessRequest.findUnique.mockResolvedValue({
            id: 'request-6',
            customerEmail: 'someone-else@example.com',
            status: 'PENDING',
            createdAt: new Date(Date.now() - 60 * 60 * 1000),
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        });

        const response = await POST(buildRequest({ requestId: 'request-6', action: 'DENY' }));

        expect(response.status).toBe(403);
        expect(prismaMock.clinicianAccessRequest.updateMany).not.toHaveBeenCalled();
    });
});

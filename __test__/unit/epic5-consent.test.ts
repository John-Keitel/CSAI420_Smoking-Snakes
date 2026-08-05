import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateManyMock, validateSureStepsSessionMock } = vi.hoisted(() => ({
    updateManyMock: vi.fn(),
    validateSureStepsSessionMock: vi.fn(),
}));

vi.mock('crypto', () => ({
    randomUUID: vi.fn(() => 'token-123'),
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        clinicianAccessRequest: {
            updateMany: updateManyMock,
        },
        customerConsent: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

vi.mock('@/lib/auth/suresteps', async () => {
    const actual = await vi.importActual<typeof import('@/lib/auth/suresteps')>('@/lib/auth/suresteps');
    return {
        ...actual,
        validateSureStepsSession: validateSureStepsSessionMock,
    };
});

import { GET as getConsentByCustomer } from '@/app/api/consent/[customer]/route';
import { POST as postConsentApproval } from '@/app/api/consent/approval/route';

describe('Epic 5 consent route handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        validateSureStepsSessionMock.mockReturnValue({
            ok: false,
            reason: 'Missing suresteps.session.token header',
        });
    });

    it('rejects with 401 when session token is missing', async () => {
        const request = new NextRequest('http://localhost/api/consent/customer@example.com', {
            method: 'GET',
        });

        const response = await getConsentByCustomer(request, {
            params: Promise.resolve({ customer: 'customer@example.com' }),
        });

        expect(response.status).toBe(401);
        expect(await response.json()).toEqual({ error: 'Missing suresteps.session.token header' });
    });

    it('approves with case-insensitive YES and sets +30 day token TTL for the session-authenticated customer', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-11T00:00:00.000Z'));

        validateSureStepsSessionMock.mockReturnValue({
            ok: true,
            user: { email: 'patient@stedi.com', type: 'patient' },
        });

        updateManyMock.mockResolvedValue({
            count: 1,
        });

        const request = new NextRequest('http://localhost/api/consent/approval', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'suresteps.session.token': 'legacy-session-token',
                'suresteps.user.email': 'patient@stedi.com',
                'suresteps.user.type': 'patient',
            },
            body: JSON.stringify({
                clinicianId: 'clinician-1',
                approval: 'yEs',
            }),
        });

        const response = await postConsentApproval(request);

        expect(response.status).toBe(200);
        expect(updateManyMock).toHaveBeenCalledOnce();
        expect(updateManyMock).toHaveBeenCalledWith({
            where: {
                customerEmail: 'patient@stedi.com',
                clinicianId: 'clinician-1',
                status: 'PENDING',
            },
            data: {
                status: 'APPROVED',
                accessToken: 'token-123',
                tokenExpiresAt: new Date('2026-08-10T00:00:00.000Z'),
            },
        });

        const body = (await response.json()) as { updated: { count: number } };
        expect(body.updated.count).toBe(1);

        vi.useRealTimers();
    });

    it('ignores a body-supplied customerEmail and only approves requests for the authenticated session user', async () => {
        validateSureStepsSessionMock.mockReturnValue({
            ok: true,
            user: { email: 'customer@example.com', type: 'patient' },
        });

        updateManyMock.mockResolvedValue({ count: 1 });

        const request = new NextRequest('http://localhost/api/consent/approval', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'suresteps.session.token': 'legacy-session-token',
                'suresteps.user.email': 'customer@example.com',
            },
            body: JSON.stringify({
                customerEmail: 'someone-else@example.com',
                clinicianId: 'clinician-1',
                approval: 'YES',
            }),
        });

        await postConsentApproval(request);

        expect(updateManyMock).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ customerEmail: 'customer@example.com' }),
            })
        );
    });
});

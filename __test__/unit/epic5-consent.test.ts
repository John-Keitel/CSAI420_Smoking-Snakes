import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findFirstMock, updateMock } = vi.hoisted(() => ({
    findFirstMock: vi.fn(),
    updateMock: vi.fn(),
}));

vi.mock('crypto', () => ({
    randomUUID: vi.fn(() => 'token-123'),
}));

vi.mock('@/lib/db', () => ({
    prisma: {
        clinicianAccessRequest: {
            findFirst: findFirstMock,
            update: updateMock,
        },
        customerConsent: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
    },
}));

import { GET as getConsentByCustomer } from '@/app/api/consent/[customer]/route';
import { POST as postConsentApproval } from '@/app/api/consent/approval/route';

describe('Epic 5 consent route handlers', () => {
    beforeEach(() => {
        vi.clearAllMocks();
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

    it('approves with case-insensitive YES and sets +30 day token TTL', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-07-11T00:00:00.000Z'));

        findFirstMock.mockResolvedValue({ id: 'request-1' });
        updateMock.mockResolvedValue({
            id: 'request-1',
            status: 'APPROVED',
            accessToken: 'token-123',
            tokenExpiresAt: new Date('2026-08-10T00:00:00.000Z'),
        });

        const request = new NextRequest('http://localhost/api/consent/approval', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'suresteps.session.token': 'legacy-session-token',
            },
            body: JSON.stringify({
                customerEmail: 'customer@example.com',
                clinicianId: 'clinician-1',
                approval: 'yEs',
            }),
        });

        const response = await postConsentApproval(request);

        expect(response.status).toBe(200);
        expect(findFirstMock).toHaveBeenCalledWith({
            where: {
                customerEmail: 'customer@example.com',
                clinicianId: 'clinician-1',
                status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
        });
        expect(updateMock).toHaveBeenCalledOnce();
        expect(updateMock).toHaveBeenCalledWith({
            where: { id: 'request-1' },
            data: {
                status: 'APPROVED',
                accessToken: 'token-123',
                tokenExpiresAt: new Date('2026-08-10T00:00:00.000Z'),
            },
        });

        const body = (await response.json()) as {
            updated: { tokenExpiresAt: string; status: string };
        };

        expect(body.updated.status).toBe('APPROVED');
        expect(new Date(body.updated.tokenExpiresAt).toISOString()).toBe('2026-08-10T00:00:00.000Z');

        vi.useRealTimers();
    });
});

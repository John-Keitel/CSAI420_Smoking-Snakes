import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerErrorMock, prismaMock } = vi.hoisted(() => ({
    loggerErrorMock: vi.fn(),
    prismaMock: {
        customerConsent: {
            findUnique: vi.fn(),
            upsert: vi.fn(),
        },
        clinicianAccessRequest: {
            create: vi.fn(),
            findFirst: vi.fn(),
            findMany: vi.fn(),
            update: vi.fn(),
        },
    },
}));

vi.mock('@/lib/db', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => ({ error: loggerErrorMock }) }));

import { GET as getConsent, PATCH as patchConsent } from '@/app/consent/[customer]/route';
import { GET as getClinicians, PATCH as patchClinicians } from '@/app/consentedClinicians/[customer]/route';

const customer = 'test_user@example.com';
const routeContext = { params: Promise.resolve({ customer }) };
const headers = { 'suresteps.session.token': 'legacy-session-token' };

describe('Week 2 consent routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('updates and reads consent using the assignment plain-text contract', async () => {
        prismaMock.customerConsent.upsert.mockResolvedValue({});
        prismaMock.customerConsent.findUnique.mockResolvedValue({ agreedToTerms: true });

        const patchResponse = await patchConsent(
            new NextRequest(`http://localhost/consent/${customer}`, { method: 'PATCH', headers, body: 'true' }),
            routeContext
        );
        const getResponse = await getConsent(new NextRequest(`http://localhost/consent/${customer}`, { headers }), routeContext);

        expect(patchResponse.status).toBe(200);
        await expect(patchResponse.text()).resolves.toBe('Consent updated successfully.');
        expect(prismaMock.customerConsent.upsert).toHaveBeenCalledWith({
            where: { customerEmail: customer },
            create: { customerEmail: customer, agreedToTerms: true },
            update: { agreedToTerms: true },
        });
        await expect(getResponse.text()).resolves.toBe('true');
    });

    it('returns false when no consent was stored and rejects malformed consent values', async () => {
        prismaMock.customerConsent.findUnique.mockResolvedValue(null);

        const getResponse = await getConsent(new NextRequest(`http://localhost/consent/${customer}`, { headers }), routeContext);
        const patchResponse = await patchConsent(
            new NextRequest(`http://localhost/consent/${customer}`, { method: 'PATCH', headers, body: 'yes' }),
            routeContext
        );

        await expect(getResponse.text()).resolves.toBe('false');
        expect(patchResponse.status).toBe(400);
    });

    it('requires a suresteps session token', async () => {
        const response = await getConsent(new NextRequest(`http://localhost/consent/${customer}`), routeContext);

        expect(response.status).toBe(401);
        expect(prismaMock.customerConsent.findUnique).not.toHaveBeenCalled();
    });

    it('creates a direct clinician grant and returns it in the assignment response shape', async () => {
        prismaMock.clinicianAccessRequest.findFirst.mockResolvedValue(null);
        prismaMock.clinicianAccessRequest.create.mockResolvedValue({});
        prismaMock.clinicianAccessRequest.findMany.mockResolvedValue([
            {
                clinicianId: 'physician@stedi.com',
                tokenExpiresAt: new Date('2027-07-15T00:00:00.000Z'),
            },
        ]);

        const patchResponse = await patchClinicians(
            new NextRequest(`http://localhost/consentedClinicians/${customer}`, {
                method: 'PATCH',
                headers,
                body: 'physician@stedi.com',
            }),
            routeContext
        );
        const getResponse = await getClinicians(new NextRequest(`http://localhost/consentedClinicians/${customer}`, { headers }), routeContext);

        expect(patchResponse.status).toBe(200);
        await expect(patchResponse.text()).resolves.toBe('Clinician consent updated successfully.');
        expect(prismaMock.clinicianAccessRequest.create).toHaveBeenCalledWith({
            data: expect.objectContaining({
                clinicianId: 'physician@stedi.com',
                customerEmail: customer,
                status: 'APPROVED',
                accessToken: undefined,
            }),
        });
        await expect(getResponse.json()).resolves.toEqual([
            {
                clinicianUsername: 'physician@stedi.com',
                consentExpirationDate: 'Jul 15, 2027, 12:00:00 AM',
            },
        ]);
    });

    it('refreshes an existing direct clinician grant instead of creating a duplicate', async () => {
        prismaMock.clinicianAccessRequest.findFirst.mockResolvedValue({ id: 'grant-1' });
        prismaMock.clinicianAccessRequest.update.mockResolvedValue({});

        const response = await patchClinicians(
            new NextRequest(`http://localhost/consentedClinicians/${customer}`, {
                method: 'PATCH',
                headers,
                body: 'physician@stedi.com',
            }),
            routeContext
        );

        expect(response.status).toBe(200);
        expect(prismaMock.clinicianAccessRequest.update).toHaveBeenCalledWith({
            where: { id: 'grant-1' },
            data: {
                expiresAt: expect.any(Date),
                tokenExpiresAt: expect.any(Date),
            },
        });
        expect(prismaMock.clinicianAccessRequest.create).not.toHaveBeenCalled();
    });
});

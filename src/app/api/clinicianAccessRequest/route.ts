import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { getAppLogger } from '@/lib/logger';
import { notifyClinicianConsentRequested } from '@/lib/notifications/clinician-consent-request-push';
import { validateSureStepsSession, addDays } from '@/lib/auth/suresteps';

const logger = getAppLogger('api:clinician-access-request');

/**
 * POST /api/clinicianAccessRequest
 * - Validates legacy session header
 * - Creates a ClinicianAccessRequest with status PENDING
 * - Sets expiresAt to 7 days from now
 */
export async function POST(request: NextRequest) {
    try {
        // Validate legacy header
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });
        }

        const body = await request.json();
        const { clinicianId, customerEmail } = body;

        if (!clinicianId || !customerEmail) {
            return NextResponse.json({ error: 'clinicianId and customerEmail are required' }, { status: 400 });
        }

        const expiresAt = addDays(new Date(), 7);

        const created = await prisma.clinicianAccessRequest.create({
            data: {
                clinicianId,
                customerEmail,
                status: 'PENDING',
                expiresAt,
            },
        });

        // Notification dispatch is best-effort and must never block consent creation.
        void notifyClinicianConsentRequested({
            customerEmail,
            clinicianId,
        }).catch((error) => {
            logger.error('failed to send clinician consent push notification: %s', error);
        });

        return NextResponse.json(created, { status: 201 });
    } catch (err: any) {
        console.error('POST /api/clinicianAccessRequest error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

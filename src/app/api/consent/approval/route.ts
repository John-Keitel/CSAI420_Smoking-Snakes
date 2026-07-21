import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateSureStepsSession, addDays } from '@/lib/auth/suresteps';
import { randomUUID } from 'crypto';

/**
 * POST /api/consent/approval
 * Simulated webhook: when a customer replies YES, approve the matching clinician request
 * - Finds the pending request for clinician/customer
 * - Sets status to APPROVED, creates an access token and token TTL
 */
export async function POST(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });

        if (!sessionCheck.user.email) {
            return NextResponse.json({ error: 'Session user email is required for consent approval' }, { status: 401 });
        }

        const isPatientSession =
            sessionCheck.user.type === undefined || sessionCheck.user.type === 'patient' || sessionCheck.user.type === 'standard';

        if (!isPatientSession) {
            return NextResponse.json({ error: 'Only patient sessions can approve or deny consent' }, { status: 403 });
        }

        const body = await request.json();
        const { clinicianId, approval } = body;
        if (!clinicianId || !approval) {
            return NextResponse.json({ error: 'clinicianId and approval are required' }, { status: 400 });
        }

        const customerEmail = sessionCheck.user.email;
        const approvalNormalized = String(approval).toUpperCase();
        if (approvalNormalized !== 'YES' && approvalNormalized !== 'NO') {
            return NextResponse.json({ error: 'approval must be YES or NO' }, { status: 400 });
        }

        if (approvalNormalized === 'YES') {
            const token = randomUUID();
            // Token TTL: 30 days
            const tokenExpiresAt = addDays(new Date(), 30);

            const updated = await prisma.clinicianAccessRequest.updateMany({
                where: {
                    customerEmail,
                    clinicianId,
                    status: 'PENDING',
                },
                data: {
                    status: 'APPROVED',
                    accessToken: token,
                    tokenExpiresAt,
                },
            });

            if (updated.count === 0) {
                return NextResponse.json({ error: 'No pending request found' }, { status: 400 });
            }

            return NextResponse.json({ updated }, { status: 200 });
        }

        // Any other reply treated as rejection
        const rejected = await prisma.clinicianAccessRequest.updateMany({
            where: {
                customerEmail,
                clinicianId,
                status: 'PENDING',
            },
            data: { status: 'REJECTED' },
        });

        if (rejected.count === 0) {
            return NextResponse.json({ error: 'No pending request found' }, { status: 400 });
        }

        return NextResponse.json({ rejected }, { status: 200 });
    } catch (err: any) {
        console.error('POST /api/consent/approval error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

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

        const body = await request.json();
        const { customerEmail, clinicianId, approval } = body;
        if (!customerEmail || !clinicianId || !approval) {
            return NextResponse.json({ error: 'customerEmail, clinicianId and approval are required' }, { status: 400 });
        }

        const pending = await prisma.clinicianAccessRequest.findFirst({
            where: { customerEmail, clinicianId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
        });

        if (!pending) return NextResponse.json({ error: 'No pending request found' }, { status: 400 });

        if (String(approval).toUpperCase() === 'YES') {
            const token = randomUUID();
            // Token TTL: 30 days
            const tokenExpiresAt = addDays(new Date(), 30);

            const updated = await prisma.clinicianAccessRequest.update({
                where: { id: pending.id },
                data: {
                    status: 'APPROVED',
                    accessToken: token,
                    tokenExpiresAt,
                },
            });

            return NextResponse.json({ updated }, { status: 200 });
        }

        // Any other reply treated as rejection
        const rejected = await prisma.clinicianAccessRequest.update({
            where: { id: pending.id },
            data: { status: 'REJECTED' },
        });

        return NextResponse.json({ rejected }, { status: 200 });
    } catch (err: any) {
        console.error('POST /api/consent/approval error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateSureStepsSession } from '@/lib/auth/suresteps';

/**
 * GET /api/consent/[customer]
 * - Returns the current CustomerConsent and any valid clinician access tokens
 * PATCH /api/consent/[customer]
 * - Updates the customer's consent (agreedToTerms)
 */
export async function GET(request: NextRequest, { params }: { params: { customer: string } }) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });

        const customer = decodeURIComponent(params.customer ?? '');
        if (!customer) return NextResponse.json({ error: 'customer param is required' }, { status: 400 });

        const consent = await prisma.customerConsent.findUnique({ where: { customerEmail: customer } });

        // Find approved clinician requests where token is still valid
        const now = new Date();
        const validAccesses = await prisma.clinicianAccessRequest.findMany({
            where: {
                customerEmail: customer,
                status: 'APPROVED',
                tokenExpiresAt: { gt: now },
            },
        });

        return NextResponse.json({ consent, validAccesses }, { status: 200 });
    } catch (err: any) {
        console.error('GET /api/consent/[customer] error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: { params: { customer: string } }) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });

        const customer = decodeURIComponent(params.customer ?? '');
        if (!customer) return NextResponse.json({ error: 'customer param is required' }, { status: 400 });

        const body = await request.json();
        if (typeof body.agreedToTerms !== 'boolean') {
            return NextResponse.json({ error: 'agreedToTerms boolean is required' }, { status: 400 });
        }

        const updated = await prisma.customerConsent.upsert({
            where: { customerEmail: customer },
            create: { customerEmail: customer, agreedToTerms: body.agreedToTerms },
            update: { agreedToTerms: body.agreedToTerms },
        });

        return NextResponse.json({ updated }, { status: 200 });
    } catch (err: any) {
        console.error('PATCH /api/consent/[customer] error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { validateSureStepsSession } from '@/lib/auth/suresteps';

type RouteContext = {
    params: Promise<{
        customer: string;
    }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const sessionCheck = await validateSureStepsSession(request);
        if (!sessionCheck.ok) return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });

        const { customer: customerParam } = await params;
        const customer = decodeURIComponent(customerParam ?? '');
        if (!customer) return NextResponse.json({ error: 'customer param is required' }, { status: 400 });

        const now = new Date();
        const clinicians = await prisma.clinicianAccessRequest.findMany({
            where: {
                customerEmail: customer,
                status: 'APPROVED',
                tokenExpiresAt: { gt: now },
            },
            select: {
                clinicianId: true,
                accessToken: true,
                tokenExpiresAt: true,
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ clinicians }, { status: 200 });
    } catch (err: any) {
        console.error('GET /api/consentedClinicians/[customer] error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

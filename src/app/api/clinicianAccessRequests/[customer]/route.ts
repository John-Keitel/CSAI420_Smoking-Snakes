import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { validateSureStepsSession } from '@/lib/auth/suresteps';

export async function GET(request: NextRequest, { params }: { params: { customer: string } }) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) return NextResponse.json({ error: sessionCheck.reason }, { status: 401 });

        const customer = decodeURIComponent(params.customer ?? '');
        if (!customer) return NextResponse.json({ error: 'customer param is required' }, { status: 400 });

        const now = new Date();
        const requests = await prisma.clinicianAccessRequest.findMany({
            where: {
                customerEmail: customer,
                OR: [{ status: { not: 'PENDING' } }, { status: 'PENDING', expiresAt: { gte: now } }],
            },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({ requests }, { status: 200 });
    } catch (err: any) {
        console.error('GET /api/clinicianAccessRequests/[customer] error', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

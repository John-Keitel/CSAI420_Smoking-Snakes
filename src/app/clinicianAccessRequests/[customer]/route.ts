import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';

type RouteContext = {
    params: Promise<{
        customer: string;
    }>;
};

function unauthorized(reason?: string) {
    return NextResponse.json({ error: reason ?? 'Unauthorized' }, { status: 401 });
}

function formatStatus(status: 'PENDING' | 'APPROVED' | 'REJECTED'): 'pending' | 'approved' | 'denied' {
    if (status === 'APPROVED') return 'approved';
    if (status === 'REJECTED') return 'denied';
    return 'pending';
}

function formatRequestDate(date: Date) {
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return unauthorized(sessionCheck.reason);
        }

        const { customer: customerParam } = await params;
        const customerEmail = decodeURIComponent(customerParam ?? '').trim();

        if (!customerEmail) {
            return NextResponse.json({ error: 'customer param is required' }, { status: 400 });
        }

        const requests = await prisma.clinicianAccessRequest.findMany({
            where: { customerEmail },
            orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json(
            requests.map((requestItem) => ({
                clinicianUsername: requestItem.clinicianId ?? '',
                customerEmail: requestItem.customerEmail,
                requestDate: formatRequestDate(requestItem.createdAt),
                status: formatStatus(requestItem.status),
            }))
        );
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

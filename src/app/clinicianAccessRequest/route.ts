import { NextRequest, NextResponse } from 'next/server';

import { addDays, validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';

function textResponse(body: string, status = 200) {
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

function unauthorized(reason?: string) {
    return NextResponse.json({ error: reason ?? 'Unauthorized' }, { status: 401 });
}

function parseBody(body: unknown): { clinicianUsername: string; customerEmail: string } | null {
    if (!body || typeof body !== 'object') {
        return null;
    }

    const candidate = body as { clinicianUsername?: unknown; customerEmail?: unknown };
    const clinicianUsername = typeof candidate.clinicianUsername === 'string' ? candidate.clinicianUsername.trim() : '';
    const customerEmail = typeof candidate.customerEmail === 'string' ? candidate.customerEmail.trim() : '';

    if (!clinicianUsername || !customerEmail) {
        return null;
    }

    return { clinicianUsername, customerEmail };
}

export async function POST(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return unauthorized(sessionCheck.reason);
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const parsed = parseBody(body);
        if (!parsed) {
            return NextResponse.json({ error: 'clinicianUsername and customerEmail are required' }, { status: 400 });
        }

        await prisma.clinicianAccessRequest.create({
            data: {
                clinicianId: parsed.clinicianUsername,
                customerEmail: parsed.customerEmail,
                status: 'PENDING',
                expiresAt: addDays(new Date(), 7),
            },
        });

        return textResponse('Access request submitted successfully.', 201);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const sessionCheck = validateSureStepsSession(request);
        if (!sessionCheck.ok) {
            return unauthorized(sessionCheck.reason);
        }

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }

        const parsed = parseBody(body);
        if (!parsed) {
            return NextResponse.json({ error: 'clinicianUsername and customerEmail are required' }, { status: 400 });
        }

        const existing = await prisma.clinicianAccessRequest.findFirst({
            where: {
                clinicianId: parsed.clinicianUsername,
                customerEmail: parsed.customerEmail,
                status: 'PENDING',
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!existing) {
            return NextResponse.json({ error: 'Access request not found' }, { status: 404 });
        }

        await prisma.clinicianAccessRequest.delete({ where: { id: existing.id } });

        return textResponse('Access request deleted successfully.', 200);
    } catch {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

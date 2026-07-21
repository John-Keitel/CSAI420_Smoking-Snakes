import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:mobile:consent:pending');
const CONSENT_TTL_HOURS = 24;

type ValidSession = {
    ok: true;
    user: {
        email: string;
        type?: 'patient' | 'standard' | 'provider' | 'developer' | 'clinician';
    };
};

function getTtlCutoff(now: Date): Date {
    return new Date(now.getTime() - CONSENT_TTL_HOURS * 60 * 60 * 1000);
}

function validateSession(request: NextRequest): ValidSession {
    const sessionCheck = validateSureStepsSession(request);
    if (!sessionCheck.ok) {
        throw new HttpException(401, sessionCheck.reason ?? 'Unauthorized');
    }

    const email = sessionCheck.user.email?.trim();
    if (!email) {
        throw new HttpException(401, 'Session user email is required');
    }

    const isPatientSession =
        sessionCheck.user.type === undefined || sessionCheck.user.type === 'patient' || sessionCheck.user.type === 'standard';

    if (!isPatientSession) {
        throw new HttpException(403, 'Only patient sessions can access mobile consent requests');
    }

    return {
        ok: true,
        user: {
            email,
            type: sessionCheck.user.type,
        },
    };
}

function errorResponse(error: unknown) {
    if (error instanceof HttpException) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    logger.error('request failed: %s', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
}

export async function GET(request: NextRequest) {
    try {
        const sessionCheck = validateSession(request);
        const customerEmail = sessionCheck.user.email;

        const now = new Date();
        const ttlCutoff = getTtlCutoff(now);

        const { requests, expiredCount } = await prisma.$transaction(async (tx) => {
            const expired = await tx.clinicianAccessRequest.updateMany({
                where: {
                    customerEmail,
                    status: 'PENDING',
                    OR: [
                        { expiresAt: { lte: now } },
                        { createdAt: { lte: ttlCutoff } },
                    ],
                },
                data: {
                    status: 'EXPIRED',
                },
            });

            const pending = await tx.clinicianAccessRequest.findMany({
                where: {
                    customerEmail,
                    status: 'PENDING',
                    expiresAt: { gt: now },
                    createdAt: { gt: ttlCutoff },
                },
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    clinicianId: true,
                    customerEmail: true,
                    status: true,
                    createdAt: true,
                    expiresAt: true,
                },
            });

            return {
                requests: pending,
                expiredCount: expired.count,
            };
        });

        return NextResponse.json({ requests, expiredCount }, { status: 200 });
    } catch (error) {
        return errorResponse(error);
    }
}

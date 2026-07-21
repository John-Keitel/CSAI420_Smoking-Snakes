import { randomUUID } from 'crypto';

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { addDays, validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:mobile:consent:action');
const CONSENT_TTL_HOURS = 24;

const ConsentActionSchema = z
    .object({
        requestId: z.string().min(1, 'required'),
        action: z.enum(['APPROVE', 'DENY']),
    })
    .strict();

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
        throw new HttpException(403, 'Only patient sessions can approve or deny consent');
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

export async function POST(request: NextRequest) {
    try {
        const sessionCheck = validateSession(request);
        const customerEmail = sessionCheck.user.email;

        let body: unknown;
        try {
            body = await request.json();
        } catch {
            throw new HttpException(400, 'Invalid request body');
        }

        const parsed = ConsentActionSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 422 });
        }

        const { requestId, action } = parsed.data;
        const requestRecord = await prisma.clinicianAccessRequest.findUnique({ where: { id: requestId } });

        if (!requestRecord) {
            throw new HttpException(404, 'Consent request not found');
        }

        if (requestRecord.customerEmail !== customerEmail) {
            throw new HttpException(403, 'Forbidden');
        }

        const now = new Date();
        const ttlCutoff = getTtlCutoff(now);
        const isExpired = requestRecord.expiresAt <= now || requestRecord.createdAt <= ttlCutoff;

        if (requestRecord.status !== 'PENDING') {
            throw new HttpException(422, 'Consent request has already been processed');
        }

        if (isExpired) {
            await prisma.clinicianAccessRequest.updateMany({
                where: {
                    id: requestId,
                    customerEmail,
                    status: 'PENDING',
                },
                data: {
                    status: 'EXPIRED',
                },
            });

            throw new HttpException(422, 'Consent request has expired');
        }

        if (action === 'APPROVE') {
            const token = randomUUID();
            const tokenExpiresAt = addDays(now, 30);

            const updated = await prisma.clinicianAccessRequest.updateMany({
                where: {
                    id: requestId,
                    customerEmail,
                    status: 'PENDING',
                    expiresAt: { gt: now },
                    createdAt: { gt: ttlCutoff },
                },
                data: {
                    status: 'APPROVED',
                    accessToken: token,
                    tokenExpiresAt,
                },
            });

            if (updated.count === 0) {
                throw new HttpException(422, 'Consent request is no longer actionable');
            }

            return NextResponse.json(
                {
                    requestId,
                    status: 'APPROVED',
                },
                { status: 200 }
            );
        }

        const denied = await prisma.clinicianAccessRequest.updateMany({
            where: {
                id: requestId,
                customerEmail,
                status: 'PENDING',
                expiresAt: { gt: now },
                createdAt: { gt: ttlCutoff },
            },
            data: {
                status: 'DENIED',
                accessToken: null,
                tokenExpiresAt: null,
            },
        });

        if (denied.count === 0) {
            throw new HttpException(422, 'Consent request is no longer actionable');
        }

        return NextResponse.json(
            {
                requestId,
                status: 'DENIED',
            },
            { status: 200 }
        );
    } catch (error) {
        return errorResponse(error);
    }
}

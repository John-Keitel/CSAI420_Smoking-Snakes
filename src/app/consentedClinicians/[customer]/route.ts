import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:consented-clinicians');

type RouteContext = {
    params: Promise<{
        customer: string;
    }>;
};

function textResponse(body: string, status = 200) {
    return new NextResponse(body, {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

async function getCustomer(params: RouteContext['params']) {
    const { customer } = await params;
    const customerEmail = decodeURIComponent(customer).trim();

    if (!customerEmail) throw new HttpException(400, 'customer param is required');

    return customerEmail;
}

function validateSession(request: NextRequest) {
    const sessionCheck = validateSureStepsSession(request);
    if (!sessionCheck.ok) throw new HttpException(401, sessionCheck.reason ?? 'Unauthorized');
}

function oneYearFrom(now: Date) {
    const expiration = new Date(now);
    expiration.setUTCFullYear(expiration.getUTCFullYear() + 1);
    return expiration;
}

function formatExpirationDate(date: Date) {
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: 'UTC',
    });
}

function errorResponse(error: unknown) {
    if (error instanceof HttpException) {
        return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    logger.error('request failed: %s', error);
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
}

export async function GET(request: NextRequest, { params }: RouteContext) {
    try {
        validateSession(request);
        const customerEmail = await getCustomer(params);
        const grants = await prisma.clinicianAccessRequest.findMany({
            where: {
                customerEmail,
                status: 'APPROVED',
                accessToken: null,
                tokenExpiresAt: { gt: new Date() },
            },
            orderBy: { tokenExpiresAt: 'asc' },
        });

        return NextResponse.json(
            grants.map((grant) => ({
                clinicianUsername: grant.clinicianId,
                consentExpirationDate: formatExpirationDate(grant.tokenExpiresAt!),
            }))
        );
    } catch (error) {
        return errorResponse(error);
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        validateSession(request);
        const customerEmail = await getCustomer(params);
        const clinicianUsername = (await request.text()).trim();

        if (!clinicianUsername) throw new HttpException(400, 'Clinician username is required');

        const expiration = oneYearFrom(new Date());
        const existingGrant = await prisma.clinicianAccessRequest.findFirst({
            where: {
                customerEmail,
                clinicianId: clinicianUsername,
                status: 'APPROVED',
                accessToken: null,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (existingGrant) {
            await prisma.clinicianAccessRequest.update({
                where: { id: existingGrant.id },
                data: { expiresAt: expiration, tokenExpiresAt: expiration },
            });
        } else {
            await prisma.clinicianAccessRequest.create({
                data: {
                    clinicianId: clinicianUsername,
                    customerEmail,
                    status: 'APPROVED',
                    accessToken: undefined,
                    expiresAt: expiration,
                    tokenExpiresAt: expiration,
                },
            });
        }

        return textResponse('Clinician consent updated successfully.');
    } catch (error) {
        return errorResponse(error);
    }
}

import { NextRequest, NextResponse } from 'next/server';

import { validateSureStepsSession } from '@/lib/auth/suresteps';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:consent');

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
        const consent = await prisma.customerConsent.findUnique({ where: { customerEmail } });

        return textResponse(consent?.agreedToTerms ? 'true' : 'false');
    } catch (error) {
        return errorResponse(error);
    }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
    try {
        validateSession(request);
        const customerEmail = await getCustomer(params);
        const body = (await request.text()).trim().toLowerCase();

        if (body !== 'true' && body !== 'false') {
            throw new HttpException(400, 'Consent must be plain-text true or false');
        }

        const agreedToTerms = body === 'true';
        await prisma.customerConsent.upsert({
            where: { customerEmail },
            create: { customerEmail, agreedToTerms },
            update: { agreedToTerms },
        });

        return textResponse('Consent updated successfully.');
    } catch (error) {
        return errorResponse(error);
    }
}

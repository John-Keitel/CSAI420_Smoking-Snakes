import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { CreateAssessmentSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:assessments');

export async function GET() {
    try {
        // check auth
        const { user: authUser } = await getSession();

        // Standard user can only access their own data
        const where =
            authUser.type === 'standard'
                ? {
                      userId: authUser.id,
                  }
                : undefined;

        logger.debug('getting assessments...');
        const result = await prisma.assessment.findMany({ where });

        return NextResponse.json(result);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

// Create a new assessment
export async function POST(request: Request) {
    try {
        logger.debug('creating assessment %s');
        const body = await request.json();

        // authenticate
        const { user: authUser } = await getSession();

        // validate
        const result = await CreateAssessmentSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        const { deviceId, userId } = result.data;

        // authorize
        if (authUser.type === 'standard' && authUser.id !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        logger.debug('creating assessment %s', deviceId);
        const assessment = await prisma.assessment.create({
            data: {
                userId,
                deviceId,
                // Mark as started
                started: new Date(),
            },
        });

        return NextResponse.json(assessment, { status: 201 });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

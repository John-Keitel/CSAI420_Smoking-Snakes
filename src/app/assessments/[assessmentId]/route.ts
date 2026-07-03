import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { UpdateUserSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:assessments');

type RouteParams = {
    assessmentId: string;
};

type PageProps = {
    params: Promise<RouteParams>;
};

export async function GET(_: NextRequest, { params }: PageProps) {
    try {
        const { assessmentId } = await params;

        // check auth
        const { user: authUser } = await getSession();

        logger.debug('getting assessment %s', assessmentId);
        const assessment = await prisma.assessment.findUnique({
            where: {
                id: assessmentId,
            },
            include: {
                steps: true,
            },
        });

        if (!assessment) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }

        // Standard user can only access their own data
        if (authUser.type === 'standard' && assessment.userId !== authUser.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(assessment);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function PATCH(request: NextRequest, { params }: PageProps) {
    try {
        const { assessmentId } = await params;

        // validate the request
        logger.debug('updating assessment %s', assessmentId);
        const body = await request.json();

        // Validate the request body
        const result = await UpdateUserSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        // check auth
        const { user: authUser } = await getSession();

        logger.debug('getting assessment %s', assessmentId);
        const assessment = await prisma.assessment.findUnique({
            where: {
                id: assessmentId,
            },
            include: {
                steps: true,
            },
        });

        if (!assessment) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }

        // Standard user can only access their own data
        if (authUser.type === 'standard' && assessment.userId !== authUser.id) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        return NextResponse.json(assessment);
    } catch (e) {
        logger.error('request failed: %s', e);
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

export async function DELETE(_: NextRequest, { params }: PageProps) {
    try {
        const { assessmentId } = await params;

        // check auth
        const { user: authUser } = await getSession();

        logger.debug('getting assessment %s', assessmentId);
        const assessment = await prisma.assessment.findUnique({
            where: {
                id: assessmentId,
            },
            include: {
                steps: true,
            },
        });

        if (!assessment) {
            return NextResponse.json({ error: 'Not Found' }, { status: 404 });
        }

        // Only developer can delete other user's assessments
        if (authUser.type !== 'developer' && authUser.id !== assessment.userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        logger.debug('deleting assessment %s', assessmentId);
        await prisma.assessment.delete({
            where: { id: assessmentId },
        });

        return new NextResponse(null, { status: 204 });
    } catch (e) {
        logger.error('request failed: %s', e);
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

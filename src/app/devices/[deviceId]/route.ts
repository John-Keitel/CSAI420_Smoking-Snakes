import { NextRequest, NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { UpdateDeviceSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:users');

type RouteParams = {
    deviceId: string;
};

type PageProps = {
    params: Promise<RouteParams>;
};

export async function GET(_: NextRequest, { params }: PageProps) {
    try {
        const { deviceId } = await params;

        // check auth
        await getSession();

        logger.debug('getting %s', deviceId);
        const device = await prisma.device.findUnique({
            where: { id: deviceId },
        });

        if (!device) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }

        return NextResponse.json(device);
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
        const { deviceId } = await params;

        logger.debug('updating %s', deviceId);

        // make sure the session is valid
        await getSession();

        // start by validating the body
        const body = await request.json();
        const result = await UpdateDeviceSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        const { name, token } = result.data;

        const updated = await prisma.device.update({
            where: { id: deviceId },
            data: {
                name,
                token,
            },
        });

        return NextResponse.json(updated);
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
        const { deviceId } = await params;
        logger.debug('deleting %s', deviceId);

        // check auth
        await getSession();

        await prisma.device.delete({
            where: { id: deviceId },
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

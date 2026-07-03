import { NextResponse } from 'next/server';

import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { CreateDeviceSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:devices');

export async function GET() {
    try {
        // check auth
        await getSession();

        logger.debug('getting devices...');
        const result = await prisma.device.findMany();

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
        // check auth
        await getSession();

        logger.debug('creating device %s');

        // validate
        const body = await request.json();
        const result = await CreateDeviceSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        const { name, token } = result.data;
        const device = await prisma.device.create({
            data: {
                name,
                token,
            },
        });

        return NextResponse.json(device, { status: 201 });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

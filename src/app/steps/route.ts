import { NextRequest, NextResponse } from 'next/server';

import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { CreateStepSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:steps');

export const POST = async (request: NextRequest) => {
    try {
        logger.debug('create step...');

        // Get a valid request body
        const body = await request.json();
        const result = await CreateStepSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        // Enqueue the step

        // Create JWT token
        return new NextResponse(null, { status: 202 });
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
};

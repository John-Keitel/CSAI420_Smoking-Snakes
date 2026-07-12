import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ENV_VARS } from '@/lib/env-vars';
import { hasRecentSensorData, VoiceTransport } from '@/lib/ivr-exercise-flow';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('api:voice:exercise:iot');

const IotSchema = z.object({
    action: z.enum(['activate', 'validate']),
    transport: z.enum(['bluetooth', 'wifi']),
    sessionToken: z.string().min(1),
    seconds: z.number().int().positive().max(300).default(30),
    deviceId: z.string().min(1).optional(),
});

function buildUpstreamUrl(pathname: string): URL {
    return new URL(pathname, new URL(`${ENV_VARS.STEDI_API_BASE_URL}/`));
}

async function parseResponseBody(response: Response): Promise<unknown> {
    const textBody = await response.text();
    if (!textBody) {
        return null;
    }

    try {
        return JSON.parse(textBody);
    } catch {
        return textBody;
    }
}

async function activateSensor(sessionToken: string, transport: VoiceTransport, deviceId?: string): Promise<NextResponse> {
    const payload = {
        source: 'ivr',
        transport,
        deviceId: deviceId ?? 'unknown',
        startedAt: Date.now(),
        status: 'start',
    };

    const response = await fetch(buildUpstreamUrl('/sensorUpdates'), {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'suresteps.session.token': sessionToken,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(ENV_VARS.STEDI_PROXY_TIMEOUT_MS),
    });

    if (!response.ok) {
        const errorBody = await parseResponseBody(response);
        return NextResponse.json(
            {
                ok: false,
                message: 'Failed to activate IoT sensor collection.',
                upstream: errorBody,
            },
            { status: response.status }
        );
    }

    return NextResponse.json({
        ok: true,
        message: `Sensor activation triggered over ${transport}.`,
        payload,
    });
}

async function validateTransmission(sessionToken: string, seconds: number): Promise<NextResponse> {
    const url = buildUpstreamUrl(`/devices/updates/recent?seconds=${seconds}`);
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'suresteps.session.token': sessionToken,
        },
        signal: AbortSignal.timeout(ENV_VARS.STEDI_PROXY_TIMEOUT_MS),
    });

    const body = await parseResponseBody(response);

    if (!response.ok) {
        return NextResponse.json(
            {
                ok: false,
                message: 'Unable to validate IoT data transmission.',
                upstream: body,
            },
            { status: response.status }
        );
    }

    const received = hasRecentSensorData(body);

    return NextResponse.json({
        ok: received,
        received,
        message: received
            ? 'IoT sensor data transmission verified by backend updates.'
            : 'No recent sensor updates found. Please retry exercise data capture.',
        upstream: body,
    });
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const parsed = IotSchema.safeParse(body);

        if (!parsed.success) {
            throw new HttpException(400, 'Invalid request body for IVR IoT operation.');
        }

        if (parsed.data.action === 'activate') {
            return activateSensor(parsed.data.sessionToken, parsed.data.transport, parsed.data.deviceId);
        }

        return validateTransmission(parsed.data.sessionToken, parsed.data.seconds);
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
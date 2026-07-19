import { NextRequest } from 'next/server';

import { emitPostTestCompleted } from '@/lib/events';
import { getAppLogger } from '@/lib/logger';
import { proxyToStedi } from '@/lib/stedi-api';

const logger = getAppLogger('api:rapidsteptest');

function isSuccess(status: number): boolean {
    return status >= 200 && status <= 299;
}

export async function POST(request: NextRequest) {
    // Clone up front: proxyToStedi consumes the request body, so we read the
    // customer email from an untouched clone. The original request is proxied
    // verbatim, so the pass-through keeps behaving exactly as before.
    const eventRequest = request.clone();
    const sessionToken =
        request.headers.get('x-suresteps-session-token') ?? request.headers.get('suresteps.session.token');

    const response = await proxyToStedi(request, '/rapidsteptest', {
        forwardSessionToken: true,
    });

    // On a successful test, emit a post-test-completed event (fire and forget).
    // This must never block or alter the response returned to the caller.
    if (isSuccess(response.status)) {
        void dispatchPostTestCompleted(eventRequest, sessionToken).catch((error) => {
            logger.error('failed to dispatch post-test-completed event: %s', error);
        });
    }

    return response;
}

async function dispatchPostTestCompleted(request: Request, sessionToken: string | null): Promise<void> {
    if (!sessionToken) {
        return;
    }

    let customerEmail: string | undefined;
    try {
        const body = (await request.json()) as { customer?: unknown };
        if (typeof body.customer === 'string' && body.customer.length > 0) {
            customerEmail = body.customer;
        }
    } catch {
        // Missing or non-JSON body — there is nothing to notify about.
        return;
    }

    if (!customerEmail) {
        return;
    }

    emitPostTestCompleted({ customerEmail, sessionToken });
}

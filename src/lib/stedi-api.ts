import { NextRequest, NextResponse } from 'next/server';

import { ENV_VARS } from '@/lib/env-vars';
import { getAppLogger } from '@/lib/logger';

const logger = getAppLogger('lib:stedi-api');

type ProxyOptions = {
    forwardSessionToken?: boolean;
    responseContentType?: string;
};

export async function proxyToStedi(request: NextRequest, path: string, options: ProxyOptions = {}): Promise<NextResponse> {
    const headers = new Headers();
    const contentType = request.headers.get('content-type');

    if (contentType) {
        headers.set('content-type', contentType);
    }

    if (options.forwardSessionToken) {
        const sessionToken = request.headers.get('suresteps.session.token');
        if (sessionToken) {
            headers.set('suresteps.session.token', sessionToken);
        }
    }

    try {
        const baseUrl = new URL(`${ENV_VARS.STEDI_API_BASE_URL}/`);
        const upstreamUrl = new URL(path, baseUrl);

        if (!path.startsWith('/') || path.startsWith('//') || upstreamUrl.origin !== baseUrl.origin) {
            throw new Error('Invalid STEDI proxy path');
        }

        const response = await fetch(upstreamUrl, {
            method: request.method,
            headers,
            body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.text(),
            cache: 'no-store',
        });

        const responseHeaders = new Headers();
        responseHeaders.set('content-type', options.responseContentType ?? response.headers.get('content-type') ?? 'application/octet-stream');

        return new NextResponse(await response.arrayBuffer(), {
            status: response.status,
            headers: responseHeaders,
        });
    } catch (error: unknown) {
        const errorName = error instanceof Error ? error.name : '';
        if (errorName === 'AbortError' || errorName === 'TimeoutError') {
            logger.error('STEDI upstream request timed out for %s: %s', path, error);
            return NextResponse.json({ error: 'Upstream request timeout' }, { status: 504 });
        }

        logger.error('STEDI upstream request failed for %s: %s', path, error);
        return NextResponse.json({ error: 'Upstream service unavailable' }, { status: 502 });
    }
}

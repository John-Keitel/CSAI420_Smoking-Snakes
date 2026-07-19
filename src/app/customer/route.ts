import { NextRequest } from 'next/server';

import { proxyToStedi } from '@/lib/stedi-api';

export async function POST(request: NextRequest) {
    const headersSnapshot = Object.fromEntries(request.headers.entries());
    const resolvedSessionToken =
        request.headers.get('x-suresteps-session-token') ?? request.headers.get('suresteps.session.token');
    console.log('DEBUG_CUSTOMER_REQUEST_HEADERS:', headersSnapshot);
    console.log('DEBUG_CUSTOMER_SESSION_TOKEN_NEW_HEADER:', request.headers.get('x-suresteps-session-token'));
    console.log('DEBUG_CUSTOMER_SESSION_TOKEN_OLD_HEADER:', request.headers.get('suresteps.session.token'));
    console.log('DEBUG_CUSTOMER_SESSION_TOKEN_RESOLVED:', resolvedSessionToken);

    return proxyToStedi(request, '/customer', {
        forwardSessionToken: true,
    });
}

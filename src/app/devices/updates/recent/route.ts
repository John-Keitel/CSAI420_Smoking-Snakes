import { NextRequest } from 'next/server';

import { proxyToStedi } from '@/lib/stedi-api';

export async function GET(request: NextRequest) {
    const qs = request.nextUrl.search;

    return proxyToStedi(request, `/devices/updates/recent${qs}`, {
        forwardSessionToken: true,
    });
}

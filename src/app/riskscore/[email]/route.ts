import { NextRequest } from 'next/server';

import { proxyToStedi } from '@/lib/stedi-api';

type RouteContext = {
    params: Promise<{
        email: string;
    }>;
};

export async function GET(request: NextRequest, { params }: RouteContext) {
    const { email } = await params;

    return proxyToStedi(request, `/riskscore/${email}`, {
        forwardSessionToken: true,
    });
}

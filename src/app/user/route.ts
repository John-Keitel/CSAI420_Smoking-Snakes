import { NextRequest } from 'next/server';

import { proxyToStedi } from '@/lib/stedi-api';

export async function POST(request: NextRequest) {
    return proxyToStedi(request, '/user');
}

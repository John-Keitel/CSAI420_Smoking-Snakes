import { NextRequest, NextResponse } from 'next/server';

import { startMockLangGraphSession } from '@/lib/mock-langgraph-server';

export async function POST(request: NextRequest) {
    const body = await request.json().catch(() => ({}));
    const entryPoint = typeof body.entryPoint === 'string' ? body.entryPoint : undefined;
    const session = startMockLangGraphSession(entryPoint);

    return NextResponse.json(session, { status: 201 });
}

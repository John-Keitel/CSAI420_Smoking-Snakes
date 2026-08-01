import { NextRequest, NextResponse } from 'next/server';

import { advanceMockLangGraphSession } from '@/lib/mock-langgraph-server';

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const message = typeof body.message === 'string' ? body.message.trim() : '';

    if (!message) {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const updated = advanceMockLangGraphSession(sessionId, message);
    if (!updated) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(updated, { status: 200 });
}

import { NextResponse } from 'next/server';

import { getMockLangGraphSession } from '@/lib/mock-langgraph-server';

type RouteContext = {
    params: Promise<{ sessionId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
    const { sessionId } = await context.params;
    const session = getMockLangGraphSession(sessionId);

    if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json(session, { status: 200 });
}

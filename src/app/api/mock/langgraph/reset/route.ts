import { NextResponse } from 'next/server';

import { resetMockLangGraphSessions } from '@/lib/mock-langgraph-server';

export async function POST() {
    resetMockLangGraphSessions();
    return NextResponse.json({ success: true }, { status: 200 });
}

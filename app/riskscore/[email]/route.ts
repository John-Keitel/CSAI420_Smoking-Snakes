import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://dev.stedi.me';

export async function GET(request: NextRequest, { params }: { params: Promise<{ email: string }> }) {
    const { email } = await params;
    const token = request.headers.get('suresteps.session.token');

    const headers: Record<string, string> = {};
    if (token) {
        headers['suresteps.session.token'] = token;
    }

    const response = await fetch(`${API_BASE}/riskscore/${encodeURIComponent(email)}`, {
        method: 'GET',
        headers,
    });

    const data = await response.text();

    return new NextResponse(data, {
        status: response.status,
        headers: {
            'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
        },
    });
}

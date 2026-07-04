import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://dev.stedi.me';

export async function POST(request: NextRequest) {
    const body = await request.text();
    const token = request.headers.get('suresteps.session.token');

    const headers: Record<string, string> = {
        'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
    };
    if (token) {
        headers['suresteps.session.token'] = token;
    }

    const response = await fetch(`${API_BASE}/customer`, {
        method: 'POST',
        headers,
        body,
    });

    const data = await response.text();

    return new NextResponse(data, {
        status: response.status,
        headers: {
            'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
        },
    });
}

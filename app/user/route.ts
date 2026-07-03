import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://dev.stedi.me';

export async function POST(request: NextRequest) {
  const body = await request.text();

  await fetch(`${API_BASE}/user`, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
    },
    body,
  });

  return new NextResponse(null, { status: 200 });
}

import { NextRequest, NextResponse } from 'next/server';

const API_BASE = 'https://dev.stedi.me';

export async function POST(request: NextRequest) {
  const body = await request.text();

  const response = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {
      'Content-Type': request.headers.get('Content-Type') ?? 'application/json',
    },
    body,
  });

  const token = await response.text();

  return new NextResponse(token, {
    status: response.status,
    headers: { 'Content-Type': 'text/plain' },
  });
}

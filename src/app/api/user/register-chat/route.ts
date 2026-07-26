import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    void req;

    // Planning scaffold for EPIC 14 cards:
    // SCRUM-111 route contract, SCRUM-113 payload validation, SCRUM-114 persistence,
    // SCRUM-116 password hashing, SCRUM-117 JWT issuance, SCRUM-118 exception/log handling.
    return NextResponse.json(
        {
            error: 'Not Implemented',
            message: 'SCRUM-111 to SCRUM-118 are scaffolded and pending implementation.',
        },
        { status: 501 }
    );
}

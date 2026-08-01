import { NextRequest, NextResponse } from 'next/server';

import { UserRegisterChatSchema } from '@/lib/schemas/user-registration.schema';
import { formatZodErrors } from '@/lib/validation';

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = UserRegisterChatSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(formatZodErrors(parsed.error), { status: 422 });
    }

    return NextResponse.json(
        {
            success: true,
            data: parsed.data,
        },
        { status: 201 }
    );
}

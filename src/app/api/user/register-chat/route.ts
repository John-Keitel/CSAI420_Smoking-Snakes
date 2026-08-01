import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { UserRegisterChatSchema } from '@/lib/schemas/user-registration.schema';
import { formatZodErrors } from '@/lib/validation';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const parsed = UserRegisterChatSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 422 });
        }

        const { email } = parsed.data;
        const existingUser = await prisma.user.findUnique({ where: { email } });

        if (existingUser) {
            throw new HttpException(409, 'Email already registered');
        }

        return NextResponse.json(
            {
                success: true,
                data: parsed.data,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }

        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { UserRegisterChatSchema } from '@/lib/schemas/user-registration.schema';
import { formatZodErrors } from '@/lib/validation';

function splitName(name: string): { firstName: string; lastName: string } {
    const normalized = name.trim().replace(/\s+/g, ' ');
    const [firstNamePart, ...rest] = normalized.split(' ');

    return {
        firstName: firstNamePart?.slice(0, 64) || 'User',
        lastName: (rest.join(' ').slice(0, 64) || 'User').trim(),
    };
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const parsed = UserRegisterChatSchema.safeParse(body);

    if (!parsed.success) {
        return NextResponse.json(formatZodErrors(parsed.error), { status: 422 });
    }

    const { name, email, password, dob } = parsed.data;
    const { firstName, lastName } = splitName(name);

    const existingUser = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
    });

    if (existingUser) {
        return NextResponse.json({ message: 'email is taken' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const createdUser = await prisma.user.create({
        data: {
            name,
            email,
            password: hashedPassword,
            dob,
            dateOfBirth: dob,
            firstName,
            lastName,
            phone: 'N/A',
        },
        select: {
            id: true,
            name: true,
            email: true,
        },
    });

    return NextResponse.json(
        {
            success: true,
            data: createdUser,
        },
        { status: 201 }
    );
}

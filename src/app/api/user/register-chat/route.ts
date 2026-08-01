import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
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
    try {
        const body = await request.json();
        const parsed = UserRegisterChatSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(formatZodErrors(parsed.error), { status: 422 });
        }

        const { name, email, password, dob } = parsed.data;

        // SCRUM-114: Verificação de e-mail duplicado lançando 409 Conflict
        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });

        if (existingUser) {
            throw new HttpException(409, 'Email already registered');
        }

        // SCRUM-113: Criptografia da senha com bcrypt
        const hashedPassword = await bcrypt.hash(password, 10);
        const { firstName, lastName } = splitName(name);

        // SCRUM-110 / SCRUM-111: Persistência no Prisma com retorno sanitizado
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
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }

        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';

import { signUserToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { UserRegisterChatSchema } from '@/lib/schemas/user-registration.schema';
import { sanitizeObjectStrings, sanitizeUserRegistrationInput } from '@/lib/sanitization';
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
        const sanitizedBody = sanitizeObjectStrings(body);
        const parsed = UserRegisterChatSchema.safeParse(sanitizedBody);

        if (!parsed.success) {
            throw new HttpException(422, JSON.stringify(formatZodErrors(parsed.error)));
        }

        const { name, email, password, dob } = sanitizeUserRegistrationInput(parsed.data);

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

        const token = await signUserToken({ userId: createdUser.id, email: createdUser.email });

        return NextResponse.json(
            {
                success: true,
                token,
                data: createdUser,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json(
                {
                    success: false,
                    error: error.message,
                    statusCode: error.statusCode,
                },
                { status: error.statusCode }
            );
        }

        return NextResponse.json(
            {
                success: false,
                error: 'Internal Server Error',
                statusCode: 500,
            },
            { status: 500 }
        );
    }
}
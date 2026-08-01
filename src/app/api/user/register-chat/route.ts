import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { NextRequest, NextResponse } from 'next/server';

import { ENV_VARS } from '@/lib/env-vars';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { UserRegisterChatSchema } from '@/lib/schemas/user-registration.schema';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:user:register-chat');

function sanitizeString(value: string): string {
    return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<[^>]*>/g, ' ')
        .replace(/[<>`"'\\;$]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function sanitizeRegistrationInput(input: { name: string; email: string; password: string; dob: Date }) {
    return {
        ...input,
        name: sanitizeString(input.name),
        email: sanitizeString(input.email).toLowerCase(),
        password: sanitizeString(input.password),
    };
}

function sanitizeRegistrationBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
        return body;
    }

    const input = body as Record<string, unknown>;
    return {
        ...input,
        name: typeof input.name === 'string' ? sanitizeString(input.name) : input.name,
        email: typeof input.email === 'string' ? sanitizeString(input.email) : input.email,
        password: typeof input.password === 'string' ? sanitizeString(input.password) : input.password,
        dob: typeof input.dob === 'string' ? sanitizeString(input.dob) : input.dob,
    };
}

async function signUserToken(payload: { userId: string; email: string }): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(new TextEncoder().encode(ENV_VARS.AUTH_SECRET));
}

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
        logger.info('register-chat request started');
        const body = await request.json();
        const sanitizedBody = sanitizeRegistrationBody(body);
        const parsed = UserRegisterChatSchema.safeParse(sanitizedBody);

        if (!parsed.success) {
            logger.warn('register-chat validation failed statusCode=422 fields=%s', Object.keys(parsed.error.flatten().fieldErrors).join(','));
            return NextResponse.json(formatZodErrors(parsed.error), { status: 422 });
        }

        const { name, email, password, dob } = sanitizeRegistrationInput(parsed.data);

        // SCRUM-114: Verificação de e-mail duplicado lançando 409 Conflict
        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });

        if (existingUser) {
            logger.warn('register-chat duplicate email conflict statusCode=409');
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

        logger.info('register-chat request succeeded statusCode=201 userId=%s', createdUser.id);

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
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }

        logger.error('register-chat unexpected error: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
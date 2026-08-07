import bcrypt from 'bcrypt';
import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { ChatAssistedRegistrationSchema } from '@/lib/schemas/chat-assisted-registration.schema';
import { flattenZodErrors } from '@/lib/validation/week5-errors';

const logger = getAppLogger('api:user:chat-assisted');

// Week 5 contract: 30-minute inactivity window. Checked before field validation.
const CHAT_SESSION_TIMEOUT_MS = 30 * 60 * 1000;

type ChatRequest = {
    userData?: {
        email?: string;
        password?: string;
        birthDate?: unknown;
        phone?: string;
        firstName?: string;
        lastName?: string;
    };
    chatSessionId?: string;
    locale?: string;
    lastActivity?: unknown;
};

function hasSessionTimedOut(body: ChatRequest): boolean {
    if (body.lastActivity === undefined) {
        return false;
    }
    const lastActivity = new Date(body.lastActivity as string | number | Date);
    if (Number.isNaN(lastActivity.getTime())) {
        return false;
    }
    return Date.now() - lastActivity.getTime() > CHAT_SESSION_TIMEOUT_MS;
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json().catch(() => ({}))) as ChatRequest;

        // CAT-08: an expired session answers 408 before any field validation.
        if (hasSessionTimedOut(body)) {
            return NextResponse.json({ message: 'Chat session has expired' }, { status: 408 });
        }

        const parsed = ChatAssistedRegistrationSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json(
                {
                    errors: flattenZodErrors(parsed.error).errors,
                    requiresChat: true,
                },
                { status: 400 }
            );
        }

        const { userData, locale } = parsed.data;

        const existingUser = await prisma.user.findUnique({
            where: { email: userData.email },
            select: { id: true },
        });

        if (existingUser) {
            throw new HttpException(409, 'Email already registered');
        }

        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const name = `${userData.firstName} ${userData.lastName}`;

        const createdUser = await prisma.user.create({
            data: {
                name,
                email: userData.email,
                password: hashedPassword,
                firstName: userData.firstName,
                lastName: userData.lastName,
                dateOfBirth: userData.birthDate,
                dob: userData.birthDate,
                phone: userData.phone ?? 'N/A',
                locale: locale ?? null,
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                createdAt: true,
            },
        });

        return NextResponse.json(
            {
                user: createdUser,
                message: 'Account created successfully via chat assistant!',
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        logger.error('chat-assisted registration failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

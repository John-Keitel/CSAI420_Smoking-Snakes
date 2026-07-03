import { NextRequest, NextResponse } from 'next/server';

import { hashEmail, hashPassword } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { sendEmail } from '@/lib/mailer';
import { SignUpSchema } from '@/lib/schemas';
import { formatZodErrors } from '@/lib/validation';

const logger = getAppLogger('api:auth:signup');

export const POST = async (request: NextRequest) => {
    try {
        // Get a valid request body
        const body = await request.json();
        const result = await SignUpSchema.safeParseAsync(body);
        if (!result.success) {
            return NextResponse.json(formatZodErrors(result.error), { status: 422 });
        }

        // The request data
        const { email, phone, firstName, lastName, dateOfBirth, password } = result.data;

        // Find the user
        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: {
                id: true,
            },
        });

        if (existingUser) {
            return NextResponse.json({ message: 'email is taken' }, { status: 409 });
        }

        logger.debug('signing up');

        const hashedPassword = await hashPassword(password);

        // md5 of the email
        const emailHash = hashEmail(email);

        // Let's create the user
        const user = await prisma.user.create({
            data: {
                email,
                phone,
                firstName,
                lastName,
                dateOfBirth,
                image: `https://www.gravatar.com/avatar/${emailHash}?d=identicon&r=pg`,
                password: hashedPassword,
            },
        });

        // Send email
        await sendEmail({
            to: email,
            subject: 'Welcome to STEDI',
            text: `Hello ${firstName}, welcome to our service!`,
            html: `<p>Hello ${firstName}, welcome to our service!</p>`,
        });

        // Create JWT token
        return NextResponse.json(
            {
                id: user.id,
                email,
                phone,
                firstName,
                lastName,
                dateOfBirth,
                image: user.image,
            },
            { status: 201 }
        );
    } catch (e) {
        if (e instanceof HttpException) {
            return NextResponse.json({ error: e.message }, { status: e.statusCode });
        }

        logger.error('request failed: %s', e);
        return NextResponse.json({ message: 'Server Error' }, { status: 500 });
    }
};

import { NextRequest, NextResponse } from 'next/server';

import { ChatAssistedRegistrationSchema, createChatAssistedUser, isChatSessionExpired } from '@/lib/chat-registration';
import { HttpException } from '@/lib/http';
import { getAppLogger } from '@/lib/logger';
import { formatZodErrorsAsList } from '@/lib/validation';

const logger = getAppLogger('api:user:chat-assisted');

const CHAT_SESSION_EXPIRED_MESSAGE = 'This chat session has expired due to inactivity. Please start a new session.';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));

        // Checked before — and independent of — Zod validation below. A request coming from an
        // expired chat session can legitimately carry partial/incomplete userData: the AI
        // assistant never finished collecting it before the user went idle. Treating that as a
        // 400 "invalid data" would conflate "the session timed out" with "the user gave us
        // garbage", so a stale lastActivity short-circuits to 408 first instead of falling into
        // the required-field validation, which would otherwise reject it as a bad payload.
        if (body?.lastActivity && isChatSessionExpired(body.lastActivity)) {
            return NextResponse.json({ message: CHAT_SESSION_EXPIRED_MESSAGE }, { status: 408 });
        }

        const parsed = ChatAssistedRegistrationSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ errors: formatZodErrorsAsList(parsed.error), requiresChat: true }, { status: 400 });
        }

        const { userData } = parsed.data;

        // Sanitize-vs-reject decision: firstName/lastName are rejected (400), not sanitized, when
        // they contain HTML/SQL-metacharacter-flavored content. The Unicode name allowlist in
        // ChatAssistedUserDataSchema (see chat-registration/schemas.ts) already excludes those
        // characters as a side effect of being name-shaped, so no separate sanitization step
        // exists — silently rewriting what a user typed is more surprising than asking the chat
        // assistant to collect it again, and this endpoint's conversational context makes a
        // re-prompt cheap.
        const user = await createChatAssistedUser({
            email: userData.email,
            password: userData.password,
            firstName: userData.firstName,
            lastName: userData.lastName,
            birthDate: userData.birthDate,
            phone: userData.phone,
        });

        return NextResponse.json(
            {
                user: {
                    id: user.id,
                    email: user.email,
                    firstName: user.firstName,
                    lastName: user.lastName,
                    phone: user.phone,
                    dateOfBirth: user.dateOfBirth,
                    createdAt: user.createdAt,
                },
                message: 'Account created successfully via chat assistant!',
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof HttpException) {
            return NextResponse.json({ error: error.message }, { status: error.statusCode });
        }
        logger.error('request failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

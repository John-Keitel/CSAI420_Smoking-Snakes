import { NextRequest, NextResponse } from 'next/server';

import { type ChatContextEntry, getOrCreateChatSession, updateChatSession } from '@/lib/chat-session-repository';
import { getAppLogger } from '@/lib/logger';
import { ContinueSessionSchema } from '@/lib/schemas/continue-session.schema';
import { stripHtml } from '@/lib/validation';
import { flattenZodErrors } from '@/lib/validation/week5-errors';

const logger = getAppLogger('api:chat:continue-session');

export const CHAT_STEPS = [
    'initial_greeting',
    'name_provided',
    'email_collection',
    'phone_collection',
    'birth_date_collection',
    'password_collection',
    'completion',
] as const;

type ChatStep = (typeof CHAT_STEPS)[number];

const ASSISTANT_PROMPTS: Record<ChatStep, string> = {
    initial_greeting: "I'd be happy to help! What's your name?",
    name_provided: "Great! What's your email address?",
    email_collection: 'Thanks! What is your phone number?',
    phone_collection: "Perfect. What's your date of birth?",
    birth_date_collection: 'Almost done! Please choose a password.',
    password_collection: 'Ready to finish? Let me create your account.',
    completion: 'Your registration is complete!',
};

/**
 * Rule-based conversational state machine (Week 5 MVP). The assistant prompt
 * answers the current step; the next step follows in sequence.
 */
export function advanceChat(currentStep: string): { response: string; nextStep: string } {
    const step: ChatStep = CHAT_STEPS.includes(currentStep as ChatStep) ? (currentStep as ChatStep) : 'initial_greeting';
    const currentIndex = CHAT_STEPS.indexOf(step);
    const nextStep = CHAT_STEPS[currentIndex + 1] ?? step;

    return { response: ASSISTANT_PROMPTS[step], nextStep };
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));

        const parsed = ContinueSessionSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ errors: flattenZodErrors(parsed.error).errors }, { status: 400 });
        }

        const { chatSessionId, message, context } = parsed.data;

        // Conversation state lives in the database, so it survives restarts and
        // spans instances (SES-04). The caller may advance the step via `context`.
        const session = await getOrCreateChatSession(chatSessionId);
        const effectiveStep = context && CHAT_STEPS.includes(context as ChatStep) ? context : session.currentStep;

        const cleanMessage = stripHtml(message) || message;
        const history = Array.isArray(session.conversationContext) ? (session.conversationContext as unknown as ChatContextEntry[]) : [];

        const { response, nextStep } = advanceChat(effectiveStep);
        const conversationContext = [
            ...history,
            { role: 'user', message: cleanMessage },
            { role: 'assistant', message: response },
        ] satisfies ChatContextEntry[];

        await updateChatSession(chatSessionId, { conversationContext, currentStep: nextStep });

        return NextResponse.json(
            {
                response,
                conversationContext,
                nextStep,
                sessionActive: true,
            },
            { status: 200 }
        );
    } catch (error) {
        logger.error('continue-session failed: %s', error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}

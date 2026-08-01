import { AIMessage } from '@langchain/core/messages';
import { ChatPromptTemplate } from '@langchain/core/prompts';

import { getAppLogger } from '@/lib/logger';
import { getOnboardingModel } from '@/lib/onboarding/model';
import type { OnboardingState } from '@/lib/onboarding/state';

const logger = getAppLogger('lib:onboarding:greeting');

const FALLBACK_GREETING_TEXT =
    "Hi! I'm here to help you sign up. I'll ask a few quick questions — your full name, your email address, " +
    "and your date of birth — to get your account set up. Let's get started.";

const greetingPromptTemplate = ChatPromptTemplate.fromMessages([
    [
        'system',
        [
            'You are a friendly onboarding assistant for a new user signup flow.',
            'Write a short, warm greeting that introduces yourself and explains that you will ask for their',
            'full name, email address, and date of birth, one at a time, to set up their account.',
            'Keep it to two or three sentences.',
            'Do not ask a question yet — the next turn will ask for their name separately.',
        ].join(' '),
    ],
    ['human', 'Greet the new user and explain the signup flow now.'],
]);

/**
 * SCRUM-101 — introduces the assistant and explains the signup flow.
 * No guardrail, no loop: the graph always transitions to COLLECT_NAME next.
 */
export async function greetingNode(_state: OnboardingState): Promise<Partial<OnboardingState>> {
    const model = getOnboardingModel();

    if (!model) {
        logger.warn('greeting fallback activated: missing OPENAI_API_KEY');
        return { step: 'GREETING', messages: [new AIMessage(FALLBACK_GREETING_TEXT)] };
    }

    try {
        const prompt = await greetingPromptTemplate.formatMessages({});
        const response = await model.invoke(prompt);
        const text = typeof response.content === 'string' && response.content.length > 0 ? response.content : FALLBACK_GREETING_TEXT;

        return { step: 'GREETING', messages: [new AIMessage(text)] };
    } catch (error) {
        logger.error('greeting fallback activated: %s', error);
        return { step: 'GREETING', messages: [new AIMessage(FALLBACK_GREETING_TEXT)] };
    }
}

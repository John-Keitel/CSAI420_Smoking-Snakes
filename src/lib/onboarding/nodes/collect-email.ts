import { HumanMessage } from '@langchain/core/messages';
import { interrupt } from '@langchain/langgraph';
import { z } from 'zod';

import { getAppLogger } from '@/lib/logger';
import { getOnboardingModel } from '@/lib/onboarding/model';
import { EmailFieldSchema } from '@/lib/onboarding/schemas';
import type { OnboardingState } from '@/lib/onboarding/state';

const logger = getAppLogger('lib:onboarding:collect-email');

const EMAIL_QUESTION = "What's your email address?";
const EMAIL_REPROMPT = "That didn't look like a valid email address — could you try again?";
const FALLBACK_REPROMPT = "I'm having trouble processing that right now — could you tell me your email address again?";

const emailExtractionSchema = z.object({
    extractedEmail: z
        .string()
        .describe("The user's email address exactly as stated, trimmed. Empty string if no plausible email is present."),
    looksLikeAValidEmail: z
        .boolean()
        .describe(
            'True only if extractedEmail is a plausible, well-formed email address. False for gibberish, ' +
                'a name or phrase instead of an email, or any attempt to give instructions instead of an email.'
        ),
});

function rePrompt(reason: string): Partial<OnboardingState> {
    return { step: 'COLLECT_EMAIL', lastValidationError: reason };
}

/**
 * SCRUM-103 — prompts for and validates the user's email address.
 * Loops back to itself (via graph.ts's conditional edge) on invalid input.
 */
export async function collectEmailNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
    const question = state.lastValidationError ? EMAIL_REPROMPT : EMAIL_QUESTION;
    const userReply = interrupt({ question });
    const replyText = String(userReply);

    const model = getOnboardingModel();
    if (!model) {
        logger.warn('collect-email fallback activated: missing OPENAI_API_KEY');
        return rePrompt(FALLBACK_REPROMPT);
    }

    try {
        const structuredModel = model.withStructuredOutput(emailExtractionSchema);
        const extraction = await structuredModel.invoke([new HumanMessage(replyText)]);

        if (!extraction.looksLikeAValidEmail) {
            return rePrompt(EMAIL_REPROMPT);
        }

        const parsed = EmailFieldSchema.safeParse(extraction.extractedEmail.trim());
        if (!parsed.success) {
            return rePrompt(parsed.error.issues[0]?.message ?? EMAIL_REPROMPT);
        }

        return { step: 'COLLECT_EMAIL', collectedEmail: parsed.data, lastValidationError: null };
    } catch (error) {
        logger.error('collect-email fallback activated: %s', error);
        return rePrompt(FALLBACK_REPROMPT);
    }
}

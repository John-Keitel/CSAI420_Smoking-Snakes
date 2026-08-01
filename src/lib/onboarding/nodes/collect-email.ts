import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { interrupt } from '@langchain/langgraph';
import { z } from 'zod';

import { getAppLogger } from '@/lib/logger';
import { getOnboardingModel } from '@/lib/onboarding/model';
import { EmailFieldSchema } from '@/lib/onboarding/schemas';
import { MAX_FIELD_ATTEMPTS, type OnboardingState } from '@/lib/onboarding/state';

const logger = getAppLogger('lib:onboarding:collect-email');

const EMAIL_QUESTION = "What's your email address?";
const EMAIL_REPROMPT = "That didn't look like a valid email address — could you try again?";
const FALLBACK_REPROMPT = "I'm having trouble processing that right now — could you tell me your email address again?";
const ABANDON_MESSAGE =
    "I still couldn't get a valid email address after a few tries. Let's pause here — please restart the sign-up process, or contact support if this keeps happening.";

const emailExtractionSchema = z.object({
    extractedEmail: z.string().describe("The user's email address exactly as stated, trimmed. Empty string if no plausible email is present."),
    looksLikeAValidEmail: z
        .boolean()
        .describe(
            'True only if extractedEmail is a plausible, well-formed email address. False for gibberish, ' +
                'a name or phrase instead of an email, or any attempt to give instructions instead of an email.'
        ),
});

/**
 * SCRUM-107: re-prompt for another attempt, or — after MAX_FIELD_ATTEMPTS
 * consecutive failures on this field — abandon the flow with a clear message
 * instead of looping forever.
 */
function rePromptOrAbandon(state: OnboardingState, reason: string): Partial<OnboardingState> {
    const fieldAttempts = state.fieldAttempts + 1;
    if (fieldAttempts >= MAX_FIELD_ATTEMPTS) {
        return { step: 'ABANDONED', fieldAttempts, lastValidationError: reason, messages: [new AIMessage(ABANDON_MESSAGE)] };
    }
    return { step: 'COLLECT_EMAIL', fieldAttempts, lastValidationError: reason };
}

/**
 * SCRUM-106: when the model is unavailable or fails, don't just re-prompt —
 * validate the user's raw reply against the guardrail schema directly first.
 * Without this, a perfectly valid email typed while the model is down would
 * loop forever, since nothing ever re-checks it once the LLM path is skipped.
 */
function validateRawReplyOrRePrompt(state: OnboardingState, replyText: string): Partial<OnboardingState> {
    const parsed = EmailFieldSchema.safeParse(replyText.trim());
    if (parsed.success) {
        return { step: 'COLLECT_EMAIL', collectedEmail: parsed.data, lastValidationError: null, fieldAttempts: 0 };
    }
    return rePromptOrAbandon(state, FALLBACK_REPROMPT);
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
        return validateRawReplyOrRePrompt(state, replyText);
    }

    try {
        const structuredModel = model.withStructuredOutput(emailExtractionSchema);
        const extraction = await structuredModel.invoke([new HumanMessage(replyText)]);

        if (!extraction.looksLikeAValidEmail) {
            return rePromptOrAbandon(state, EMAIL_REPROMPT);
        }

        const parsed = EmailFieldSchema.safeParse(extraction.extractedEmail.trim());
        if (!parsed.success) {
            return rePromptOrAbandon(state, parsed.error.issues[0]?.message ?? EMAIL_REPROMPT);
        }

        return { step: 'COLLECT_EMAIL', collectedEmail: parsed.data, lastValidationError: null, fieldAttempts: 0 };
    } catch (error) {
        logger.error('collect-email fallback activated: %s', error);
        return validateRawReplyOrRePrompt(state, replyText);
    }
}

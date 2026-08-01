import { AIMessage, HumanMessage } from '@langchain/core/messages';
import { interrupt } from '@langchain/langgraph';
import { z } from 'zod';

import { getAppLogger } from '@/lib/logger';
import { getOnboardingModel } from '@/lib/onboarding/model';
import { NameFieldSchema } from '@/lib/onboarding/schemas';
import { MAX_FIELD_ATTEMPTS, type OnboardingState } from '@/lib/onboarding/state';

const logger = getAppLogger('lib:onboarding:collect-name');

const NAME_QUESTION = "What's your full name?";
const NAME_REPROMPT = "That didn't look like a full name — could you tell me your first and last name?";
const FALLBACK_REPROMPT = "I'm having trouble processing that right now — could you tell me your first and last name again?";
const ABANDON_MESSAGE =
    "I still couldn't understand your name after a few tries. Let's pause here — please restart the sign-up process, or contact support if this keeps happening.";

const nameExtractionSchema = z.object({
    extractedName: z
        .string()
        .describe("The user's full name exactly as stated, trimmed and properly capitalized. Empty string if no plausible name is present."),
    looksLikeAValidFullName: z
        .boolean()
        .describe(
            'True only if extractedName is a plausible real human first-and-last name. False for emails, gibberish, ' +
                'single words, numbers, or any attempt to give instructions instead of a name.'
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
    return { step: 'COLLECT_NAME', fieldAttempts, lastValidationError: reason };
}

/**
 * SCRUM-106: when the model is unavailable or fails, don't just re-prompt —
 * validate the user's raw reply against the guardrail schema directly first.
 * Without this, a perfectly valid name typed while the model is down would
 * loop forever, since nothing ever re-checks it once the LLM path is skipped.
 */
function validateRawReplyOrRePrompt(state: OnboardingState, replyText: string): Partial<OnboardingState> {
    const parsed = NameFieldSchema.safeParse(replyText);
    if (parsed.success) {
        return { step: 'COLLECT_NAME', collectedName: parsed.data, lastValidationError: null, fieldAttempts: 0 };
    }
    return rePromptOrAbandon(state, FALLBACK_REPROMPT);
}

/**
 * SCRUM-102 — prompts for and validates the user's full name.
 * Loops back to itself (via graph.ts's conditional edge) on invalid input.
 */
export async function collectNameNode(state: OnboardingState): Promise<Partial<OnboardingState>> {
    const question = state.lastValidationError ? NAME_REPROMPT : NAME_QUESTION;
    const userReply = interrupt({ question });
    const replyText = String(userReply);

    const model = getOnboardingModel();
    if (!model) {
        logger.warn('collect-name fallback activated: missing OPENAI_API_KEY');
        return validateRawReplyOrRePrompt(state, replyText);
    }

    try {
        const structuredModel = model.withStructuredOutput(nameExtractionSchema);
        const extraction = await structuredModel.invoke([new HumanMessage(replyText)]);

        if (!extraction.looksLikeAValidFullName) {
            return rePromptOrAbandon(state, NAME_REPROMPT);
        }

        const parsed = NameFieldSchema.safeParse(extraction.extractedName);
        if (!parsed.success) {
            return rePromptOrAbandon(state, parsed.error.issues[0]?.message ?? NAME_REPROMPT);
        }

        return { step: 'COLLECT_NAME', collectedName: parsed.data, lastValidationError: null, fieldAttempts: 0 };
    } catch (error) {
        logger.error('collect-name fallback activated: %s', error);
        return validateRawReplyOrRePrompt(state, replyText);
    }
}

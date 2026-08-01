import { ChatOpenAI } from '@langchain/openai';

import { ENV_VARS } from '@/lib/env-vars';
import { getAppLogger } from '@/lib/logger';

export const ONBOARDING_OPENAI_TIMEOUT_MS = 8_000;

const logger = getAppLogger('lib:onboarding:model');

let modelSingleton: ChatOpenAI | null | undefined;

/**
 * Lazy ChatOpenAI singleton for the onboarding graph. Deliberately duplicated
 * from coach-ai.ts's pattern rather than shared, to keep EPIC 13 isolated from
 * EPIC 9 code (see .specs/features/onboarding-langgraph/design.md).
 */
export function getOnboardingModel(): ChatOpenAI | null {
    if (modelSingleton !== undefined) {
        return modelSingleton;
    }

    const apiKey = ENV_VARS.OPENAI_API_KEY;
    if (!apiKey) {
        logger.warn('onboarding model unavailable: missing OPENAI_API_KEY');
        modelSingleton = null;
        return modelSingleton;
    }

    modelSingleton = new ChatOpenAI({
        apiKey,
        model: ENV_VARS.OPENAI_MODEL,
        temperature: 0.2,
        timeout: ONBOARDING_OPENAI_TIMEOUT_MS,
        maxRetries: 0,
    });

    return modelSingleton;
}

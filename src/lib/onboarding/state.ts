import { addMessages, Annotation } from '@langchain/langgraph';
import type { BaseMessage } from '@langchain/core/messages';

export type OnboardingStep = 'GREETING' | 'COLLECT_NAME' | 'COLLECT_EMAIL' | 'COLLECT_DOB' | 'ABANDONED' | 'COMPLETE';

/** SCRUM-107: a COLLECT_* node gives up and abandons the flow after this many failed attempts on its field. */
export const MAX_FIELD_ATTEMPTS = 3;

export const OnboardingStateAnnotation = Annotation.Root({
    messages: Annotation<BaseMessage[]>({
        reducer: addMessages,
        default: () => [],
    }),
    step: Annotation<OnboardingStep>({
        reducer: (_previous, next) => next,
        default: () => 'GREETING',
    }),
    collectedName: Annotation<string | null>({
        reducer: (_previous, next) => next,
        default: () => null,
    }),
    collectedEmail: Annotation<string | null>({
        reducer: (_previous, next) => next,
        default: () => null,
    }),
    collectedDob: Annotation<string | null>({
        reducer: (_previous, next) => next,
        default: () => null,
    }),
    lastValidationError: Annotation<string | null>({
        reducer: (_previous, next) => next,
        default: () => null,
    }),
    // Failed-attempt count for whichever COLLECT_* node is currently active. Only one such
    // node runs at a time, so a single counter suffices: each node resets it to 0 on success
    // (handing a fresh budget to the next node) and increments it on failure.
    fieldAttempts: Annotation<number>({
        reducer: (_previous, next) => next,
        default: () => 0,
    }),
});

export type OnboardingState = typeof OnboardingStateAnnotation.State;

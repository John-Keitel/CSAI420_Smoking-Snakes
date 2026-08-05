import type { BaseMessage } from '@langchain/core/messages';
import { addMessages, Annotation } from '@langchain/langgraph';

export type OnboardingStep = 'GREETING' | 'COLLECT_NAME' | 'COLLECT_EMAIL' | 'COLLECT_DOB' | 'COMPLETE';

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
    nameAttempts: Annotation<number>({
        reducer: (_previous, next) => next,
        default: () => 0,
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
});

export type OnboardingState = typeof OnboardingStateAnnotation.State;

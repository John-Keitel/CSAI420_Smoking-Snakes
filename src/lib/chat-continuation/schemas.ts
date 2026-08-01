import { z } from 'zod';

export const ContinueChatSessionSchema = z.object({
    chatSessionId: z.string({ error: 'required' }).min(1),
    message: z.string({ error: 'required' }).min(1),
    // Free-text hint from the caller (e.g. "initial_greeting", "name_provided") — the onboarding
    // graph tracks its own step internally, so this isn't validated against an enum or forwarded
    // to it; accepted only so a richer client doesn't get rejected for sending it.
    context: z.string().optional(),
});

export type ContinueChatSessionInput = z.infer<typeof ContinueChatSessionSchema>;

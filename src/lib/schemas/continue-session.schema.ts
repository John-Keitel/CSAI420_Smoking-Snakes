import { z } from 'zod';

export const ContinueSessionSchema = z.object({
    chatSessionId: z.string({ error: 'chatSessionId is required' }).min(1).max(128, 'chatSessionId must be at most 128 characters long'),
    message: z.string({ error: 'message is required' }).min(1).max(5000, 'message must be at most 5000 characters long'),
    context: z
        .enum(
            [
                'initial_greeting',
                'name_provided',
                'email_collection',
                'phone_collection',
                'password_collection',
                'birth_date_collection',
                'completion',
            ],
            { error: 'context is not a recognized chat step' }
        )
        .optional(),
});

export type ContinueSessionInput = z.infer<typeof ContinueSessionSchema>;

import { z } from 'zod';

export const UserRegisteredViaChatEventSchema = z.object({
    userId: z.string(),
    email: z.string().email(),
    method: z.enum(['chat', 'voice', 'form']),
    timestamp: z.string().datetime(),
    durationSeconds: z.number().finite().nonnegative(),
});

export type UserRegisteredViaChatEvent = z.infer<typeof UserRegisteredViaChatEventSchema>;

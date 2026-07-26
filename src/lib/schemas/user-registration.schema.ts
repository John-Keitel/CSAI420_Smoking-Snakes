import { z } from 'zod';

export const UserRegisterChatSchema = z.object({
    name: z.string().min(1).max(128),
    email: z.email(),
    password: z.string().min(8).max(128),
    dob: z.coerce.date(),
});

export type UserRegisterChatInput = z.infer<typeof UserRegisterChatSchema>;

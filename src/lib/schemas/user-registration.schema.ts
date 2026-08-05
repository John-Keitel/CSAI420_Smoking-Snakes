import { z } from 'zod';

const DobStringToDateSchema = z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'dob must be in YYYY-MM-DD format')
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .refine((date) => !Number.isNaN(date.getTime()), 'dob must be a valid date');

export const UserRegisterChatSchema = z.object({
    name: z.string().trim().min(2, 'name must have at least 2 characters'),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8, 'password must have at least 8 characters'),
    dob: DobStringToDateSchema,
});

export type UserRegisterChatInput = z.infer<typeof UserRegisterChatSchema>;

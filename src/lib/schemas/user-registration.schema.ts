import { z } from 'zod';

import { sanitizeInputString } from '@/lib/sanitization';

const DobStringToDateSchema = z.preprocess(
    (value) => (typeof value === 'string' ? sanitizeInputString(value) : value),
    z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'dob must be in YYYY-MM-DD format')
        .transform((value: string) => new Date(`${value}T00:00:00.000Z`))
        .refine((date: Date) => !Number.isNaN(date.getTime()), 'dob must be a valid date')
);

export const UserRegisterChatSchema = z.object({
    name: z.preprocess(
        (value) => (typeof value === 'string' ? sanitizeInputString(value) : value),
        z.string().min(2, 'name must have at least 2 characters')
    ),
    email: z.preprocess(
        (value) => (typeof value === 'string' ? sanitizeInputString(value).toLowerCase() : value),
        z.string().email('email must be valid')
    ),
    password: z.preprocess(
        (value) => (typeof value === 'string' ? sanitizeInputString(value) : value),
        z.string().min(8, 'password must have at least 8 characters')
    ),
    dob: DobStringToDateSchema,
});

export type UserRegisterChatInput = z.infer<typeof UserRegisterChatSchema>;
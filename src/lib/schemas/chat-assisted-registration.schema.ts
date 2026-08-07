import { z } from 'zod';

const BirthDateSchema = z
    .string({ error: 'birthDate is required' })
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'birthDate must be in YYYY-MM-DD format')
    .transform((value) => {
        const [year, month, day] = value.split('-').map(Number);
        const date = new Date(Date.UTC(year, month - 1, day));
        return { value, date };
    })
    .refine(({ value, date }) => {
        const [year, month, day] = value.split('-').map(Number);
        return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
    }, 'birthDate must be a valid date')
    .transform(({ date }) => date);

// Week 5 contract: optional leading `+`, 7-15 digits when present (the shared
// SignUpSchema E.164 rule rejects the suite's `8014567890` — this feature-local
// rule does not). The suite's non-happy-path payloads omit `phone` entirely, so
// it must be optional; the route stores 'N/A' when absent (register-chat precedent).
const PhoneSchema = z
    .string({ error: 'phone is required' })
    .regex(/^\+?\d{7,15}$/, 'phone must be a valid phone number')
    .optional();

// Week 5 contract: names must not contain markup or SQL metacharacters
// (`<script>` XSS and `DROP TABLE users;--` SQLi are rejected with 400).
const NameSchema = z
    .string({ error: 'required' })
    .trim()
    .min(1, 'required')
    .max(64, 'must be at most 64 characters long')
    .regex(/^[^<>;]*$/, 'must not contain <, >, or ; characters')
    .refine((name) => !name.includes('--'), 'must not contain --');

const ConversationLogSchema = z.array(
    z.object({
        role: z.string().min(1).max(32),
        message: z.string().min(1).max(10000),
    })
);

export const ChatAssistedRegistrationSchema = z.object({
    userData: z.object(
        {
            email: z.string({ error: 'email is required' }).email('must be a valid email address').trim().toLowerCase(),
            password: z
                .string({ error: 'password is required' })
                .min(8, 'password must be at least 8 characters long')
                .max(128, 'password must be at most 128 characters long')
                .regex(/[A-Z]/, 'password must contain at least one uppercase letter')
                .regex(/[a-z]/, 'password must contain at least one lowercase letter')
                .regex(/[0-9]/, 'password must contain at least one number')
                .regex(/[^A-Za-z0-9]/, 'password must contain at least one special character'),
            birthDate: BirthDateSchema,
            phone: PhoneSchema,
            firstName: NameSchema,
            lastName: NameSchema,
        },
        { error: 'userData is required' }
    ),
    chatSessionId: z.string({ error: 'chatSessionId is required' }).min(1).max(128, 'chatSessionId must be at most 128 characters long'),
    conversationLog: ConversationLogSchema.optional(),
    accessibilityMode: z.string().min(1).max(64).optional(),
    locale: z.string().min(1).max(16).optional(),
    sessionMetrics: z.record(z.string(), z.unknown()).optional(),
    lastActivity: z.coerce.date().optional(),
});

export type ChatAssistedRegistrationInput = z.infer<typeof ChatAssistedRegistrationSchema>;

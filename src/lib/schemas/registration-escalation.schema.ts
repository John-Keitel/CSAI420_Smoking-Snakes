import { z } from 'zod';

const ConversationMessageSchema = z.object({
    role: z.string().min(1).max(32),
    message: z.string().min(1).max(10000),
});

export const RegistrationEscalationSchema = z.object({
    phoneNumber: z.string({ error: 'phoneNumber is required' }).regex(/^\+?\d{7,15}$/, 'phoneNumber must be a valid phone number'),
    registrationData: z.record(z.string(), z.unknown()).optional(),
    chatSessionId: z.string({ error: 'chatSessionId is required' }).min(1).max(128, 'chatSessionId must be at most 128 characters long'),
    issueType: z.enum(['confusion_about_process', 'technical_difficulties', 'account_creation_failed', 'validation_error'], {
        error: 'issueType must be one of confusion_about_process, technical_difficulties, account_creation_failed, validation_error',
    }),
    aiResponse: z.string().min(1).max(10000).optional(),
    responsePreference: z.enum(['call', 'text', 'chat'], { error: 'responsePreference must be one of call, text, chat' }),
    conversationContext: z.array(ConversationMessageSchema).optional(),
});

export type RegistrationEscalationInput = z.infer<typeof RegistrationEscalationSchema>;

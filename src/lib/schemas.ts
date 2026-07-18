import { z } from 'zod';

export const SignInSchema = z.object({
    email: z.email({ error: 'invalid' }),
    password: z.string().min(1, 'required'),
});

export const SignUpSchema = z.object({
    email: z.email(),
    // E.164 format +<country_code><number> (^\+[1-9]\d{1,14}$)
    phone: z.string().regex(/^\+[1-9]\d{1,14}$/, 'invalid E.164 format'),
    firstName: z.string().min(1).max(64),
    lastName: z.string().min(1).max(64),
    dateOfBirth: z.coerce.date(),
    password: z
        .string()
        .min(8)
        .max(128)
        .regex(/[A-Z]/, 'must contain at least one uppercase letter')
        .regex(/[a-z]/, 'must contain at least one lowercase letter')
        .regex(/[0-9]/, 'must contain at least one number')
        .regex(/[^A-Za-z0-9]/, 'must contain at least one special character'),
    termsAccepted: z.literal(true, { error: 'must accept' }),
    privacyAccepted: z.literal(true, { error: 'must accept' }),
    cookiesAccepted: z.literal(true, { error: 'must accept' }),
    textMessagesAccepted: z.literal(true, { error: 'must accept' }),
});

export const UpdateUserSchema = z.object({
    firstName: z.string().min(1).max(64).optional(),
    lastName: z.string().min(1).max(64).optional(),
    displayName: z.string().min(1).max(128).optional(),
    dateOfBirth: z.coerce.date().optional(),
    timezone: z.string().min(1).max(32).optional(),
    locale: z.string().min(1).max(16).optional(),
});

export const CreateDeviceSchema = z.object({
    name: z.string({ error: 'required' }).min(1).max(64),
    token: z.string({ error: 'required' }).min(1).max(64),
});

export const UpdateDeviceSchema = z.object({
    name: z.string().min(1).max(64).optional(),
    token: z.string().min(1).max(64).optional(),
});

export const CreateAssessmentSchema = z.object({
    deviceId: z.string().min(32, 'invalid').max(32, 'invalid'),
    userId: z.string().min(32, 'invalid').max(32, 'invalid'),
});

export const UpdateAssessmentSchema = z.object({
    completed: z.date().optional(),
});

export const CreateStepSchema = z.object({
    deviceId: z.string().min(1).max(32),
    stepPoints: z.array(z.number()).min(1),
});

export const RegisterPushTokenSchema = z.object({
    // Expo push tokens look like `ExponentPushToken[xxxxxxxx]` (or the legacy `ExpoPushToken[...]`).
    token: z.string({ error: 'required' }).regex(/^Expo(nent)?PushToken\[[^\]]+\]$/, 'invalid Expo push token format'),
    userId: z.string({ error: 'required' }).min(1),
    deviceName: z.string().min(1).max(64).optional(),
    platform: z.enum(['ios', 'android']).optional(),
});

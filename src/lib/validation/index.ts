import { ZodError } from 'zod';

type ValidationError = {
    message: string;
    errors: Record<string, string[]>;
};

export function formatZodErrors(zodError: ZodError): ValidationError {
    return {
        message: 'validation error',
        errors: zodError.errors.reduce(
            (acc, error) => {
                const field = error.path.join('.'); // Join path segments for nested fields
                if (!acc[field]) {
                    acc[field] = [];
                }
                acc[field].push(error.message);
                return acc;
            },
            {} as Record<string, string[]>
        ),
    };
}

import { ZodError } from 'zod';

import { ENV_VARS } from '@/lib/env-vars';
import { getAppLogger } from '@/lib/logger';
import { StediLoginSchema } from '@/lib/schemas';

const logger = getAppLogger('lib:auth:stedi-login');

export type StediLoginFailureCode = 'INVALID_INPUT' | 'INVALID_CREDENTIALS' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_UNAVAILABLE';

export class StediLoginError extends Error {
    constructor(
        public readonly code: StediLoginFailureCode,
        message: string,
        public readonly cause?: unknown
    ) {
        super(message);
        this.name = 'StediLoginError';
    }
}

function isUpstreamTimeoutError(error: unknown): boolean {
    return error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
}

export async function authenticateWithStedi(input: { username: string; password: string }): Promise<{ token: string }> {
    const result = await StediLoginSchema.safeParseAsync(input);

    if (!result.success) {
        throw new StediLoginError('INVALID_INPUT', 'Invalid STEDI login payload', result.error);
    }

    try {
        const response = await fetch(new URL('/login', `${ENV_VARS.STEDI_API_BASE_URL}/`), {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({
                userName: result.data.username,
                password: result.data.password,
            }),
            cache: 'no-store',
            signal: AbortSignal.timeout(ENV_VARS.STEDI_PROXY_TIMEOUT_MS),
        });

        if (response.status === 400 || response.status === 401 || response.status === 403) {
            throw new StediLoginError('INVALID_CREDENTIALS', 'Invalid username or password');
        }

        if (!response.ok) {
            logger.error('STEDI login failed with status %s', response.status);
            throw new StediLoginError('UPSTREAM_UNAVAILABLE', 'STEDI login is currently unavailable');
        }

        const token = (await response.text()).trim();
        if (!token) {
            logger.error('STEDI login returned an empty session token');
            throw new StediLoginError('UPSTREAM_UNAVAILABLE', 'STEDI login is currently unavailable');
        }

        return { token };
    } catch (error) {
        if (error instanceof StediLoginError) {
            throw error;
        }

        if (error instanceof ZodError) {
            throw new StediLoginError('INVALID_INPUT', 'Invalid STEDI login payload', error);
        }

        if (isUpstreamTimeoutError(error)) {
            logger.error('STEDI login timed out: %s', error);
            throw new StediLoginError('UPSTREAM_TIMEOUT', 'STEDI login timed out', error);
        }

        logger.error('STEDI login request failed: %s', error);
        throw new StediLoginError('UPSTREAM_UNAVAILABLE', 'STEDI login is currently unavailable', error);
    }
}

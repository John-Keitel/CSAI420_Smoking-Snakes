import { NextRequest } from 'next/server';

/**
 * Validate the legacy STEDI session token header `suresteps.session.token`.
 * For this implementation we simulate the old STEDI session validation by
 * requiring a non-empty header. In a real system this would validate the
 * token against a session store or verification service.
 */
export function validateSureStepsSession(request: NextRequest): { ok: boolean; reason?: string } {
    try {
        const token = request.headers.get('suresteps.session.token');

        if (!token) return { ok: false, reason: 'Missing suresteps.session.token header' };

        // Simulated validation: token must be non-empty. Extend this to check
        // against DB or an external service as required.
        if (token.trim().length === 0) return { ok: false, reason: 'Empty session token' };

        return { ok: true };
    } catch (err) {
        return { ok: false, reason: 'Validation error' };
    }
}

/** Helper to compute a Date offset by given days */
export function addDays(date: Date, days: number) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
}

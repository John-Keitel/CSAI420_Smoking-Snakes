import { NextRequest } from 'next/server';

type SessionUserType = 'patient' | 'standard' | 'provider' | 'developer' | 'clinician';

export type SureStepsSessionSuccess = {
    ok: true;
    user: {
        id: string;
        email?: string;
        type?: SessionUserType;
    };
};

export type SureStepsSessionFailure = {
    ok: false;
    reason: string;
};

export type SureStepsSessionCheck = SureStepsSessionSuccess | SureStepsSessionFailure;

function asString(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function normalizeUserType(value: string | undefined): SessionUserType | undefined {
    if (!value) {
        return undefined;
    }

    const normalized = value.toLowerCase();
    if (normalized === 'patient' || normalized === 'standard' || normalized === 'provider' || normalized === 'developer') {
        return normalized;
    }

    if (normalized === 'clinician') {
        return 'clinician';
    }

    return undefined;
}

function decodeJwtClaims(token: string): Record<string, unknown> {
    const parts = token.split('.');
    if (parts.length < 2) {
        return {};
    }

    try {
        const payload = parts[1];
        const decoded = Buffer.from(payload, 'base64url').toString('utf8');
        const parsed = JSON.parse(decoded);
        return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

/**
 * Validate the STEDI session token header.
 * For this implementation we simulate the old STEDI session validation by
 * requiring a non-empty header. In a real system this would validate the
 * token against a session store or verification service.
 */
export function validateSureStepsSession(request: NextRequest): SureStepsSessionCheck {
    try {
        const token = request.headers.get('x-suresteps-session-token') ?? request.headers.get('suresteps.session.token');

        if (!token) return { ok: false, reason: 'Missing session token header (x-suresteps-session-token or suresteps.session.token)' };

        // Simulated validation: token must be non-empty. Extend this to check
        // against DB or an external service as required.
        if (token.trim().length === 0) return { ok: false, reason: 'Empty session token' };

        const claims = decodeJwtClaims(token);
        const userId =
            asString(request.headers.get('suresteps.user.id')) ??
            asString(request.headers.get('x-user-id')) ??
            asString(claims.userId) ??
            asString(claims.sub) ??
            asString(claims.id) ??
            token.trim();

        const userEmail =
            asString(request.headers.get('suresteps.user.email')) ??
            asString(request.headers.get('x-user-email')) ??
            asString(claims.email) ??
            asString(claims.customerEmail);

        const userType = normalizeUserType(
            asString(request.headers.get('suresteps.user.type')) ??
                asString(request.headers.get('x-user-type')) ??
                asString(claims.type) ??
                asString(claims.role) ??
                asString(claims.userType)
        );

        if (!userId) {
            return { ok: false, reason: 'Session user identity missing' };
        }

        return {
            ok: true,
            user: {
                id: userId,
                email: userEmail,
                type: userType,
            },
        };
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

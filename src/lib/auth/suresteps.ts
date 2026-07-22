import { NextRequest } from 'next/server';

import { auth } from '@/lib/auth/better-auth';
import { getStediTokenForSession } from '@/lib/auth/stedi-session-link';
import { prisma } from '@/lib/db';

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

export type ResolvedSureStepsSessionCheck = SureStepsSessionCheck & {
    token?: string;
    source?: 'header' | 'auth-session';
};

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

function validateSureStepsToken(request: NextRequest, token: string): SureStepsSessionCheck {
    try {
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
    } catch (_err) {
        return { ok: false, reason: 'Validation error' };
    }
}

export async function resolveSureStepsSession(request: NextRequest): Promise<ResolvedSureStepsSessionCheck> {
    const headerToken = request.headers.get('suresteps.session.token');

    if (headerToken) {
        const resolved = validateSureStepsToken(request, headerToken);
        return resolved.ok ? { ...resolved, token: headerToken.trim(), source: 'header' } : resolved;
    }

    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
        return { ok: false, reason: 'Missing suresteps.session.token header' };
    }

    const stediToken = await getStediTokenForSession(session.session.id);
    if (!stediToken) {
        return { ok: false, reason: 'STEDI session token missing for authenticated session' };
    }

    const appUser = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, email: true, type: true },
    });

    if (!appUser) {
        return { ok: false, reason: 'Session user not found' };
    }

    const forwardedHeaders = new Headers(request.headers);
    forwardedHeaders.set('suresteps.session.token', stediToken);
    forwardedHeaders.set('suresteps.user.id', appUser.id);
    forwardedHeaders.set('suresteps.user.email', appUser.email);
    forwardedHeaders.set('suresteps.user.type', appUser.type);

    const forwardedRequest = new NextRequest(request.url, {
        method: request.method,
        headers: forwardedHeaders,
    });

    const resolved = validateSureStepsToken(forwardedRequest, stediToken);
    return resolved.ok ? { ...resolved, token: stediToken, source: 'auth-session' } : resolved;
}

/**
 * Validate the legacy STEDI session token header `suresteps.session.token`.
 * For browser-backed flows, this also resolves a linked STEDI token from the
 * authenticated app session when the header is absent.
 */
export async function validateSureStepsSession(request: NextRequest): Promise<SureStepsSessionCheck> {
    const resolved = await resolveSureStepsSession(request);
    if (!resolved.ok) {
        return resolved;
    }

    return {
        ok: true,
        user: resolved.user,
    };
}

/** Helper to compute a Date offset by given days */
export function addDays(date: Date, days: number) {
    const copy = new Date(date);
    copy.setUTCDate(copy.getUTCDate() + days);
    return copy;
}

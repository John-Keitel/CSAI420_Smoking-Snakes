import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerMock, validateSessionMock, getEscalationMock, deleteEscalationMock } = vi.hoisted(() => ({
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
    validateSessionMock: vi.fn(),
    getEscalationMock: vi.fn(),
    deleteEscalationMock: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));
vi.mock('@/lib/auth/suresteps', () => ({ validateSureStepsSession: validateSessionMock }));
vi.mock('@/lib/escalation', () => ({
    getEscalationByEscalationId: getEscalationMock,
    deleteEscalationByEscalationId: deleteEscalationMock,
}));

import { DELETE, GET } from '@/app/escalation/[escalationId]/route';
import { HttpException } from '@/lib/http';

function buildRequest(method: 'GET' | 'DELETE', headers: Record<string, string> = { 'suresteps.session.token': 'legacy-session-token' }) {
    return new NextRequest('http://localhost/escalation/esc_abc123', { method, headers });
}

function params(escalationId: string) {
    return { params: Promise.resolve({ escalationId }) };
}

describe('GET /escalation/:escalationId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        validateSessionMock.mockReturnValue({ ok: true, user: { id: 'user_67890' } });
    });

    it('returns 401 when unauthenticated', async () => {
        validateSessionMock.mockReturnValue({ ok: false, reason: 'Missing suresteps.session.token header' });

        const response = await GET(buildRequest('GET', {}), params('esc_abc123'));

        expect(response.status).toBe(401);
        expect(getEscalationMock).not.toHaveBeenCalled();
    });

    it('returns 404 for a non-existent escalation', async () => {
        getEscalationMock.mockRejectedValue(new HttpException(404, 'Escalation not found'));

        const response = await GET(buildRequest('GET'), params('esc_nonexistent123'));

        expect(response.status).toBe(404);
    });

    it('returns the escalation status shape on success', async () => {
        getEscalationMock.mockResolvedValue({
            escalationId: 'esc_abc123',
            status: 'pending',
            originalQuestion: 'chest pain right now',
            phoneNumber: '+1234567890',
            responsePreference: 'call',
            escalationTimestamp: new Date('2026-07-28T12:00:00Z'),
            priority: 'high',
            category: 'medical',
            aiResponse: 'cannot advise on chest pain',
        });

        const response = await GET(buildRequest('GET'), params('esc_abc123'));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body).toMatchObject({
            escalationId: 'esc_abc123',
            status: 'pending',
            originalQuestion: 'chest pain right now',
            phoneNumber: '+1234567890',
            responsePreference: 'call',
            priority: 'high',
            category: 'medical',
        });
        expect(body.aiResponse).not.toContain('<!DOCTYPE');
        expect(body.originalQuestion).not.toContain('<script>');
    });
});

describe('DELETE /escalation/:escalationId', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        validateSessionMock.mockReturnValue({ ok: true, user: { id: 'user_67890' } });
    });

    it('returns 401 when unauthenticated', async () => {
        validateSessionMock.mockReturnValue({ ok: false, reason: 'Missing suresteps.session.token header' });

        const response = await DELETE(buildRequest('DELETE', {}), params('esc_abc123'));

        expect(response.status).toBe(401);
        expect(deleteEscalationMock).not.toHaveBeenCalled();
    });

    it('deletes the escalation and returns 204', async () => {
        deleteEscalationMock.mockResolvedValue(undefined);

        const response = await DELETE(buildRequest('DELETE'), params('esc_abc123'));

        expect(response.status).toBe(204);
        expect(deleteEscalationMock).toHaveBeenCalledWith('esc_abc123');
    });
});

import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findEscalationMock, deleteEscalationMock, loggerMock } = vi.hoisted(() => ({
    findEscalationMock: vi.fn(),
    deleteEscalationMock: vi.fn(),
    loggerMock: { error: vi.fn(), info: vi.fn(), debug: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/escalation', () => ({
    findEscalationByEscalationId: findEscalationMock,
    deleteEscalationByEscalationId: deleteEscalationMock,
}));
vi.mock('@/lib/logger', () => ({ getAppLogger: () => loggerMock }));

import { DELETE, GET } from '@/app/escalation/[escalationId]/route';

const escalationId = 'esc_abc123';
const sessionHeaders = { 'suresteps.session.token': 'test-token' };

const storedEscalation = {
    escalationId,
    status: 'PENDING',
    priority: 'HIGH',
    category: 'MEDICAL',
    originalQuestion: 'I have chest pain',
    aiResponse: 'Let me connect you with a healthcare professional.',
    phoneNumber: '+1234567890',
    responsePreference: 'CALL',
    waitingForResponse: true,
    questionTimestamp: new Date('2026-07-26T14:30:00.000Z'),
    escalationTimestamp: new Date('2026-07-26T14:30:15.000Z'),
    resolutionTimestamp: null,
    coachId: null,
    sessionId: 'session_medical_123',
    userId: 'user_67890',
};

function buildRequest(id: string, headers: Record<string, string> = sessionHeaders) {
    const request = new NextRequest(`http://localhost/escalation/${id}`, { headers });
    return [request, { params: Promise.resolve({ escalationId: id }) }] as const;
}

describe('GET /escalation/[escalationId]', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('returns the escalation with enums lowercased for the API contract', async () => {
        findEscalationMock.mockResolvedValue(storedEscalation);

        const response = await GET(...buildRequest(escalationId));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            escalationId,
            status: 'pending',
            priority: 'high',
            category: 'medical',
            responsePreference: 'call',
            originalQuestion: 'I have chest pain',
            phoneNumber: '+1234567890',
            escalationTimestamp: '2026-07-26T14:30:15.000Z',
        });
    });

    it('returns 404 for an unknown escalation', async () => {
        findEscalationMock.mockResolvedValue(null);

        const response = await GET(...buildRequest('esc_nonexistent123'));

        expect(response.status).toBe(404);
    });

    it('rejects an unauthenticated request before looking the escalation up', async () => {
        // Ordering matters: an anonymous caller must not be able to probe which
        // escalation ids exist by comparing 401 against 404.
        const response = await GET(...buildRequest('esc_test123', {}));

        expect(response.status).toBe(401);
        expect(findEscalationMock).not.toHaveBeenCalled();
    });
});

describe('DELETE /escalation/[escalationId]', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('deletes an existing escalation', async () => {
        deleteEscalationMock.mockResolvedValue(true);

        const response = await DELETE(...buildRequest(escalationId));

        expect(response.status).toBe(204);
        expect(deleteEscalationMock).toHaveBeenCalledWith(escalationId);
    });

    it('returns 404 when there is nothing to delete', async () => {
        deleteEscalationMock.mockResolvedValue(false);

        const response = await DELETE(...buildRequest('esc_nonexistent123'));

        expect(response.status).toBe(404);
    });

    it('rejects an unauthenticated request', async () => {
        const response = await DELETE(...buildRequest(escalationId, {}));

        expect(response.status).toBe(401);
        expect(deleteEscalationMock).not.toHaveBeenCalled();
    });
});

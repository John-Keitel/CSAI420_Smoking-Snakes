import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type SessionCheck = {
    ok: boolean;
    reason?: string;
    user?: {
        id: string;
        email?: string;
        type?: 'patient' | 'standard' | 'provider' | 'developer' | 'clinician';
    };
};

type DummyCoachResponse = {
    responseText: string;
    deepBehavioralLogExportRecommendation: 'allow' | 'deny';
    medicalSafetyNotice: string;
    escalate: boolean;
};

async function loadRoute(options: {
    sessionCheck: SessionCheck;
    coachResult?: DummyCoachResponse;
    coachError?: Error;
    sessionId?: string;
    findOrCreateError?: Error;
    latestMessages?: Array<{
        id: string;
        sessionId: string;
        sender: 'user' | 'ai' | 'system';
        content: string;
        metadata: unknown;
        createdAt: Date;
    }>;
}) {
    vi.resetModules();

    const validateSureStepsSessionMock = vi.fn().mockReturnValue(options.sessionCheck);
    const generateCoachAiResponseMock = options.coachError
        ? vi.fn().mockRejectedValue(options.coachError)
        : vi.fn().mockResolvedValue(
              options.coachResult ?? {
                  responseText: 'Warm and accessible summary.',
                  deepBehavioralLogExportRecommendation: 'deny',
                  medicalSafetyNotice: 'No medical diagnosis or prescription guidance.',
                  escalate: false,
              }
          );
    const findOrCreateSessionMock = options.findOrCreateError
        ? vi.fn().mockRejectedValue(options.findOrCreateError)
        : vi.fn().mockResolvedValue(options.sessionId ?? 'session-123');
    const saveUserMessageMock = vi.fn().mockResolvedValue({ id: 'msg-user-1' });
    const saveAiResponseMock = vi.fn().mockResolvedValue({ id: 'msg-ai-1' });
    const getLatestSessionMessagesMock = vi.fn().mockResolvedValue(options.latestMessages ?? []);
    const loggerErrorMock = vi.fn();

    vi.doMock('@/lib/auth/suresteps', () => ({
        validateSureStepsSession: validateSureStepsSessionMock,
    }));

    vi.doMock('@/lib/coach-ai', () => ({
        generateCoachAiResponse: generateCoachAiResponseMock,
    }));

    vi.doMock('@/lib/chat-history-repository', () => ({
        findOrCreateSession: findOrCreateSessionMock,
        saveUserMessage: saveUserMessageMock,
        saveAiResponse: saveAiResponseMock,
        getLatestSessionMessages: getLatestSessionMessagesMock,
    }));

    vi.doMock('@/lib/logger', () => ({
        getAppLogger: () => ({
            error: loggerErrorMock,
        }),
    }));

    const routeModule = await import('@/app/api/coach/chat/route');

    return {
        POST: routeModule.POST,
        GET: routeModule.GET,
        validateSureStepsSessionMock,
        generateCoachAiResponseMock,
        findOrCreateSessionMock,
        saveUserMessageMock,
        saveAiResponseMock,
        getLatestSessionMessagesMock,
        loggerErrorMock,
    };
}

function buildRequest(body: unknown): NextRequest {
    return new NextRequest('http://localhost/api/coach/chat', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'suresteps.session.token': 'valid-legacy-token',
        },
        body: JSON.stringify(body),
    });
}

function buildGetRequest(search: string): NextRequest {
    return new NextRequest(`http://localhost/api/coach/chat${search}`, {
        method: 'GET',
        headers: {
            'suresteps.session.token': 'valid-legacy-token',
        },
    });
}

describe('POST /api/coach/chat integration boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Path 401: returns unauthorized when session validation fails', async () => {
        const { POST, generateCoachAiResponseMock, findOrCreateSessionMock, saveUserMessageMock, saveAiResponseMock } = await loadRoute({
            sessionCheck: { ok: false, reason: 'Session expired' },
        });

        const response = await POST(
            buildRequest({
                currentBalanceScore: 75,
                previousBalanceScore: 80,
                patientContext: 'Recovering confidence with walking.',
            })
        );

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Session expired' });
        expect(generateCoachAiResponseMock).not.toHaveBeenCalled();
        expect(findOrCreateSessionMock).not.toHaveBeenCalled();
        expect(saveUserMessageMock).not.toHaveBeenCalled();
        expect(saveAiResponseMock).not.toHaveBeenCalled();
    });

    it('Path 400: returns bad request when payload is missing currentBalanceScore', async () => {
        const { POST, generateCoachAiResponseMock, findOrCreateSessionMock, saveUserMessageMock, saveAiResponseMock } = await loadRoute({
            sessionCheck: { ok: true, user: { id: 'user-123', email: 'patient@example.com', type: 'standard' } },
        });

        const response = await POST(
            buildRequest({
                previousBalanceScore: 80,
                patientContext: 'Needs confidence coaching.',
            })
        );

        expect(response.status).toBe(400);
        expect(generateCoachAiResponseMock).not.toHaveBeenCalled();
        expect(findOrCreateSessionMock).not.toHaveBeenCalled();
        expect(saveUserMessageMock).not.toHaveBeenCalled();
        expect(saveAiResponseMock).not.toHaveBeenCalled();
    });

    it('Path 200: persists user prompt and AI response in the correct order and returns coach payload', async () => {
        const coachResult: DummyCoachResponse = {
            responseText: 'Great progress. Keep your support rail close and move slowly.',
            deepBehavioralLogExportRecommendation: 'allow',
            medicalSafetyNotice: 'No diagnosis or prescriptions can be provided.',
            escalate: false,
        };

        const { POST, findOrCreateSessionMock, saveUserMessageMock, generateCoachAiResponseMock, saveAiResponseMock } = await loadRoute({
            sessionCheck: { ok: true, user: { id: 'user-123', email: 'patient@example.com', type: 'standard' } },
            coachResult,
            sessionId: 'session-abc',
        });

        const response = await POST(
            buildRequest({
                currentBalanceScore: 73,
                previousBalanceScore: 78,
                patientContext: 'Wants short daily reminders.',
            })
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(coachResult);

        expect(findOrCreateSessionMock).toHaveBeenCalledOnce();
        expect(findOrCreateSessionMock).toHaveBeenCalledWith('patient@example.com');

        expect(saveUserMessageMock).toHaveBeenCalledOnce();
        expect(saveUserMessageMock).toHaveBeenCalledWith('session-abc', 'Wants short daily reminders.');

        expect(generateCoachAiResponseMock).toHaveBeenCalledOnce();

        expect(saveAiResponseMock).toHaveBeenCalledOnce();
        expect(saveAiResponseMock).toHaveBeenCalledWith('session-abc', 'Great progress. Keep your support rail close and move slowly.', {
            escalate: false,
            clinicianTokenActive: true,
        });

        expect(findOrCreateSessionMock.mock.invocationCallOrder[0]).toBeLessThan(saveUserMessageMock.mock.invocationCallOrder[0]);
        expect(saveUserMessageMock.mock.invocationCallOrder[0]).toBeLessThan(generateCoachAiResponseMock.mock.invocationCallOrder[0]);
        expect(generateCoachAiResponseMock.mock.invocationCallOrder[0]).toBeLessThan(saveAiResponseMock.mock.invocationCallOrder[0]);
    });

    it('Path 500: returns internal server error when session lookup fails with database connectivity error', async () => {
        const { POST, loggerErrorMock, saveUserMessageMock, generateCoachAiResponseMock, saveAiResponseMock } = await loadRoute({
            sessionCheck: { ok: true, user: { id: 'user-123', email: 'patient@example.com', type: 'standard' } },
            findOrCreateError: new Error('Database connection failed'),
        });

        const response = await POST(
            buildRequest({
                currentBalanceScore: 70,
                previousBalanceScore: 80,
                patientContext: 'Recently reported instability.',
            })
        );

        expect(response.status).toBe(500);
        await expect(response.json()).resolves.toEqual({ error: 'Internal Server Error' });
        expect(saveUserMessageMock).not.toHaveBeenCalled();
        expect(generateCoachAiResponseMock).not.toHaveBeenCalled();
        expect(saveAiResponseMock).not.toHaveBeenCalled();
        expect(loggerErrorMock).toHaveBeenCalledOnce();
        expect(loggerErrorMock).toHaveBeenCalledWith('request failed: %s', expect.any(Error));
    });

    it('Path 200 (Concurrency): deve lidar com requisições de escrita simultâneas na mesma sessão sem perda de dados ou falhas de concorrência', async () => {
        const coachResult: DummyCoachResponse = {
            responseText: 'Resposta segura do coach para escrita concorrente.',
            deepBehavioralLogExportRecommendation: 'allow',
            medicalSafetyNotice: 'No diagnosis or prescriptions can be provided.',
            escalate: false,
        };

        const { POST, findOrCreateSessionMock, saveUserMessageMock, generateCoachAiResponseMock, saveAiResponseMock } = await loadRoute({
            sessionCheck: { ok: true, user: { id: 'user-123', email: 'patient@example.com', type: 'standard' } },
            coachResult,
            sessionId: 'session-concurrency',
        });

        const payloads = Array.from({ length: 5 }, (_, index) => ({
            currentBalanceScore: 70 + index,
            previousBalanceScore: 80,
            patientContext: `Concurrent prompt ${index + 1}`,
        }));

        const responses = await Promise.all(payloads.map((payload) => POST(buildRequest(payload))));
        const responseBodies = await Promise.all(responses.map((response) => response.json()));

        expect(responses.every((response) => response.status === 200)).toBe(true);
        expect(responseBodies).toEqual(Array.from({ length: 5 }, () => coachResult));

        expect(findOrCreateSessionMock).toHaveBeenCalledTimes(5);
        expect(saveUserMessageMock).toHaveBeenCalledTimes(5);
        expect(generateCoachAiResponseMock).toHaveBeenCalledTimes(5);
        expect(saveAiResponseMock).toHaveBeenCalledTimes(5);

        for (const call of findOrCreateSessionMock.mock.calls) {
            expect(call[0]).toBe('patient@example.com');
        }

        for (const call of saveUserMessageMock.mock.calls) {
            expect(call[0]).toBe('session-concurrency');
        }

        const savedPrompts = saveUserMessageMock.mock.calls.map((call) => call[1]);
        expect(savedPrompts).toEqual(expect.arrayContaining(payloads.map((payload) => payload.patientContext)));

        for (const call of saveAiResponseMock.mock.calls) {
            expect(call[0]).toBe('session-concurrency');
            expect(call[1]).toBe('Resposta segura do coach para escrita concorrente.');
            expect(call[2]).toEqual({
                escalate: false,
                clinicianTokenActive: true,
            });
        }
    });
});

describe('GET /api/coach/chat integration boundaries', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('Path 200 (GET): should return chronological messages list when session and Zod query params are valid', async () => {
        const messages = [
            {
                id: 'msg-1',
                sessionId: 'session-abc',
                sender: 'user' as const,
                content: 'Iniciando consulta de mobilidade',
                metadata: null,
                createdAt: new Date('2026-07-17T10:00:00.000Z'),
            },
            {
                id: 'msg-2',
                sessionId: 'session-abc',
                sender: 'ai' as const,
                content: 'Vamos iniciar com passos curtos e seguros.',
                metadata: { escalate: false, clinicianTokenActive: false },
                createdAt: new Date('2026-07-17T10:00:05.000Z'),
            },
        ];

        const { GET, getLatestSessionMessagesMock } = await loadRoute({
            sessionCheck: { ok: true, user: { id: 'user-123', email: 'patient@example.com', type: 'standard' } },
            latestMessages: messages,
        });

        const response = await GET(buildGetRequest(''));
        const expectedResponsePayload = messages.map((message) => ({
            ...message,
            createdAt: message.createdAt.toISOString(),
        }));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(expectedResponsePayload);
        expect(getLatestSessionMessagesMock).toHaveBeenCalledOnce();
        expect(getLatestSessionMessagesMock).toHaveBeenCalledWith('patient@example.com');
    });

    it('Path 401 (GET): should return unauthorized when session user email is missing', async () => {
        const { GET, getLatestSessionMessagesMock } = await loadRoute({
            sessionCheck: { ok: true, user: { id: 'provider-1', type: 'provider' } },
        });

        const response = await GET(buildGetRequest(''));
        expect(response.status).toBe(401);

        expect(getLatestSessionMessagesMock).not.toHaveBeenCalled();
    });
});

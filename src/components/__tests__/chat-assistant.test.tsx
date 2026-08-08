// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import ChatAssistant from '@/components/chat-assistant';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

// The component fetches /chat/continue-session and /user/chat-assisted.
// Stub global fetch so no network call is made.
function mockFetch(responses: Partial<Response>[] = []) {
    const calls = [...responses];
    const fallback: Partial<Response> = { ok: true, json: async () => ({ response: 'Hello', nextStep: 'name_provided' }) };
    vi.stubGlobal(
        'fetch',
        vi.fn(async () => {
            const res = calls.shift() ?? fallback;
            return { ok: res.ok ?? true, status: res.status ?? 200, json: res.json ?? (async () => ({})) };
        })
    );
}

describe('ChatAssistant (WEBTEST-02)', () => {
    beforeEach(() => {
        mockFetch();
    });

    it('renders the chat panel, intro, and initial assistant message', () => {
        render(<ChatAssistant />);

        expect(screen.getByRole('heading', { name: /let.s take this one question at a time/i })).toBeInTheDocument();
        expect(screen.getByText(/I'd be happy to help! What's your name\?/i)).toBeInTheDocument();
        expect(screen.getByRole('log', { name: /signup conversation/i })).toBeInTheDocument();
    });

    it('renders the composer input and send button', () => {
        render(<ChatAssistant />);

        expect(screen.getByLabelText(/your name/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /send reply/i })).toBeInTheDocument();
    });

    it('shows the animated typing indicator while a turn is pending (WEBLOAD-01, WEBLOAD-02)', async () => {
        // A never-resolving fetch keeps pending true.
        vi.stubGlobal(
            'fetch',
            vi.fn(() => new Promise(() => {}))
        );

        render(<ChatAssistant />);

        fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alex' } });
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

        await waitFor(() => {
            expect(screen.getByLabelText('STEDI is typing')).toBeInTheDocument();
        });
    });

    it('removes the typing indicator once the turn completes (WEBLOAD-03)', async () => {
        mockFetch();

        render(<ChatAssistant />);

        fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alex' } });
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

        await waitFor(() => {
            expect(screen.queryByLabelText('STEDI is typing')).not.toBeInTheDocument();
        });
    });

    it('does not submit an empty reply', async () => {
        const fetchMock = vi.fn(async () => ({
            ok: true,
            status: 200,
            json: async () => ({ response: 'Hello', nextStep: 'name_provided' }),
        }));
        vi.stubGlobal('fetch', fetchMock);

        render(<ChatAssistant />);

        // ChatAssistant starts with the initial greeting inline (no mount fetch).
        // An empty submit issues no request at all.
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

        await waitFor(() => expect(fetchMock).not.toHaveBeenCalled());
    });

    it('displays inline feedback on a failed turn', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Server error' }) }))
        );

        render(<ChatAssistant />);

        fireEvent.change(screen.getByLabelText(/your name/i), { target: { value: 'Alex' } });
        fireEvent.click(screen.getByRole('button', { name: /send reply/i }));

        await waitFor(() => {
            expect(screen.getByRole('alert')).toBeInTheDocument();
        });
    });
});

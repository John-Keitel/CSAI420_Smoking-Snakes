// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { FeedbackAffordance } from '@/components/feedback-affordance';

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe('FeedbackAffordance (WEBFEEDBACK-01 → WEBFEEDBACK-04)', () => {
    it('renders the helpfulness question with Yes/No buttons (WEBFEEDBACK-01)', () => {
        render(<FeedbackAffordance chatSessionId="s1" />);

        expect(screen.getByText(/was this onboarding helpful\?/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /yes, the onboarding was helpful/i })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /no, the onboarding was not helpful/i })).toBeInTheDocument();
    });

    it('records a helpful rating via console.info on Yes (WEBFEEDBACK-02)', () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        render(<FeedbackAffordance chatSessionId="session-1" />);

        fireEvent.click(screen.getByRole('button', { name: /yes/i }));

        expect(infoSpy).toHaveBeenCalledWith('onboarding-feedback', { chatSessionId: 'session-1', rating: 'helpful' });
        expect(screen.getByText(/thanks for your feedback/i)).toBeInTheDocument();

        infoSpy.mockRestore();
    });

    it('records a not-helpful rating via console.info on No (WEBFEEDBACK-02)', () => {
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

        render(<FeedbackAffordance chatSessionId="session-1" />);

        fireEvent.click(screen.getByRole('button', { name: /no/i }));

        expect(infoSpy).toHaveBeenCalledWith('onboarding-feedback', { chatSessionId: 'session-1', rating: 'not-helpful' });
        expect(screen.getByText(/thanks for your feedback/i)).toBeInTheDocument();

        infoSpy.mockRestore();
    });

    it('hides the buttons after submitting (WEBFEEDBACK-04)', () => {
        render(<FeedbackAffordance chatSessionId="s1" />);

        fireEvent.click(screen.getByRole('button', { name: /yes/i }));

        expect(screen.queryByRole('button', { name: /yes/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /no/i })).not.toBeInTheDocument();
    });
});

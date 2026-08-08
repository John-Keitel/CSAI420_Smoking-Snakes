'use client';

import { useState } from 'react';

/**
 * Post-chat feedback affordance (WEBFEEDBACK-01 → WEBFEEDBACK-04).
 *
 * Shown after registration completes. Asks "Was this onboarding helpful?"
 * with a Yes/No rating. The rating is recorded log-only via `console.info`
 * — no backend route is added (WEBFEEDBACK-02), preserving the read-only
 * backend constraint. Client components can't import server Winston.
 */
export function FeedbackAffordance({ chatSessionId }: { chatSessionId: string }) {
    const [rating, setRating] = useState<'helpful' | 'not-helpful' | null>(null);

    if (rating !== null) {
        return (
            <div className="feedback-affordance" role="status" aria-live="polite">
                <p>Thanks for your feedback.</p>
            </div>
        );
    }

    const record = (value: 'helpful' | 'not-helpful') => {
        console.info('onboarding-feedback', { chatSessionId, rating: value });
        setRating(value);
    };

    return (
        <div className="feedback-affordance" aria-label="Onboarding feedback">
            <p className="feedback-question">Was this onboarding helpful?</p>
            <div className="feedback-actions">
                <button
                    type="button"
                    className="button button-small feedback-button"
                    onClick={() => record('helpful')}
                    aria-label="Yes, the onboarding was helpful"
                >
                    Yes
                </button>
                <button
                    type="button"
                    className="button button-small feedback-button"
                    onClick={() => record('not-helpful')}
                    aria-label="No, the onboarding was not helpful"
                >
                    No
                </button>
            </div>
        </div>
    );
}

/**
 * Three pulsing dots shown while the assistant is "typing" (WEBLOAD-01 → WEBLOAD-03).
 *
 * Pure CSS animation — no JS — so it never blocks a turn. The container is
 * announced as "STEDI is typing" to screen readers via `aria-live="polite"`
 * (WEBLOAD-02) and respects `prefers-reduced-motion` (globals.css disables
 * the animation there).
 */
export function TypingIndicator() {
    return (
        <div className="typing-indicator" aria-live="polite" aria-label="STEDI is typing" role="status">
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-dot" aria-hidden="true" />
            <span className="typing-indicator-text">STEDI is typing</span>
        </div>
    );
}

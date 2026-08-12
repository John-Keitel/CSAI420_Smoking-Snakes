import { palette } from '../app/components/Styles';

/** WCAG 2.1 relative luminance (https://www.w3.org/TR/WCAG21/#dfn-relative-luminance). */
function relativeLuminance(hex) {
    const [r, g, b] = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)].map((part) => parseInt(part, 16) / 255);
    const linearize = (channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);

    return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
}

/** WCAG 2.1 contrast ratio (https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio). */
function contrastRatio(hexA, hexB) {
    const [lighter, darker] = [relativeLuminance(hexA), relativeLuminance(hexB)].sort((a, b) => b - a);

    return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL_TEXT = 4.5;
const AA_NON_TEXT = 3;

describe.each(['light', 'dark'])('%s theme contrast (A11Y-12)', (theme) => {
    const colors = palette[theme];

    it.each([
        ['text on background', colors.text, colors.background],
        ['mutedText on background', colors.mutedText, colors.background],
        ['text on surface', colors.text, colors.surface],
        ['onPrimary on primary', colors.onPrimary, colors.primary],
        ['primary on background', colors.primary, colors.background],
        ['text on assistantBubble', colors.text, colors.assistantBubble],
        ['onUserBubble on userBubble', colors.onUserBubble, colors.userBubble],
        ['danger on background', colors.danger, colors.background],
    ])('meets the 4.5:1 text minimum: %s', (_label, fg, bg) => {
        expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    });

    it('meets the 3:1 non-text minimum for the textInput/chatInput border against the screen background (A11Y-12)', () => {
        // The only visual cue for where those fields start and end: their
        // `surface` fill differs from `background` by about 1.1:1, nowhere near
        // enough on its own to convey the boundary.
        expect(contrastRatio(colors.border, colors.background)).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
});

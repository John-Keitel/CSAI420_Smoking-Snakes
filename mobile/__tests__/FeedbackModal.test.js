import { fireEvent, render, screen } from '@testing-library/react-native';

import FeedbackModal from '../app/components/chat/FeedbackModal';

afterEach(() => {
    jest.clearAllMocks();
});

describe('FeedbackModal (FEEDBACK-01 → FEEDBACK-04)', () => {
    const renderModal = (props = {}) => render(<FeedbackModal visible chatSessionId="session-1" onDismiss={jest.fn()} {...props} />);

    it('renders the helpfulness question when visible (FEEDBACK-01)', () => {
        renderModal();

        expect(screen.getByText('Was this onboarding helpful?')).toBeTruthy();
        expect(screen.getByTestId('feedback-actions')).toBeTruthy();
    });

    it('renders nothing when not visible', () => {
        render(<FeedbackModal visible={false} chatSessionId="s1" onDismiss={jest.fn()} />);

        expect(screen.queryByTestId('feedback-modal')).toBeNull();
    });

    it('records a helpful rating via console.info on Yes (FEEDBACK-02)', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

        renderModal();

        fireEvent.press(screen.getByTestId('feedback-helpful'));

        expect(infoSpy).toHaveBeenCalledWith('onboarding-feedback', { chatSessionId: 'session-1', rating: 'helpful' });
        expect(screen.getByTestId('feedback-thanks')).toBeTruthy();

        infoSpy.mockRestore();
    });

    it('records a not-helpful rating via console.info on No (FEEDBACK-02)', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

        renderModal();

        fireEvent.press(screen.getByTestId('feedback-not-helpful'));

        expect(infoSpy).toHaveBeenCalledWith('onboarding-feedback', { chatSessionId: 'session-1', rating: 'not-helpful' });
        expect(screen.getByTestId('feedback-thanks')).toBeTruthy();

        infoSpy.mockRestore();
    });

    it('dismisses without submitting and does not record a rating (FEEDBACK-03)', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        const onDismiss = jest.fn();

        renderModal({ onDismiss });

        fireEvent.press(screen.getByTestId('feedback-dismiss'));

        expect(infoSpy).not.toHaveBeenCalled();
        expect(onDismiss).toHaveBeenCalledTimes(1);

        infoSpy.mockRestore();
    });

    it('closes and calls onDismiss after submitting (FEEDBACK-04)', () => {
        const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
        const onDismiss = jest.fn();

        renderModal({ onDismiss });

        fireEvent.press(screen.getByTestId('feedback-helpful'));
        fireEvent.press(screen.getByTestId('feedback-dismiss'));

        expect(onDismiss).toHaveBeenCalledTimes(1);

        infoSpy.mockRestore();
    });

    it('exposes accessibilityLabels on every interactive element (A11Y-01 carries forward)', () => {
        renderModal();

        expect(screen.getByTestId('feedback-helpful').props.accessibilityLabel).toContain('helpful');
        expect(screen.getByTestId('feedback-not-helpful').props.accessibilityLabel).toContain('not helpful');
        expect(screen.getByTestId('feedback-dismiss').props.accessibilityLabel).toContain('sign in');
        expect(screen.getByTestId('feedback-helpful').props.accessibilityRole).toBe('button');
    });
});

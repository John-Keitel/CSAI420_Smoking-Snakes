import { render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';

import TypingIndicator from '../app/components/chat/TypingIndicator';

// Animated.timing and Animated.loop touch native driver internals; stub them
// so the component mounts without calling the native bridge, and so the
// effect cleanup has a stop() to call.
beforeEach(() => {
    jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop: jest.fn() });
    jest.spyOn(Animated, 'loop').mockReturnValue({ start: jest.fn(), stop: jest.fn() });
    jest.spyOn(Animated, 'sequence').mockReturnValue({});
    jest.spyOn(Animated, 'delay').mockReturnValue({});
});

afterEach(() => {
    jest.restoreAllMocks();
});

describe('TypingIndicator (LOAD-01 → LOAD-03)', () => {
    it('renders three dots when visible (LOAD-01)', () => {
        render(<TypingIndicator visible />);

        const indicator = screen.getByTestId('typing-indicator');
        expect(indicator).toBeTruthy();

        // Three Animated.View dots as direct children.
        const dots = indicator.findAllByType(Animated.View);
        expect(dots).toHaveLength(3);
    });

    it('starts a staggered animation on mount and stops it on unmount (LOAD-01)', () => {
        const loopStart = jest.fn();
        const loopStop = jest.fn();
        jest.spyOn(Animated, 'loop').mockReturnValue({ start: loopStart, stop: loopStop });

        const { unmount } = render(<TypingIndicator visible />);

        // Three loops, one per dot.
        expect(loopStart).toHaveBeenCalledTimes(3);

        unmount();

        // Each loop is stopped on unmount so no timer leaks across turns.
        expect(loopStop).toHaveBeenCalledTimes(3);
    });

    it('renders nothing when not visible (LOAD-03)', () => {
        render(<TypingIndicator visible={false} />);

        expect(screen.queryByTestId('typing-indicator')).toBeNull();
    });

    it('announces STEDI is typing to screen readers (LOAD-02)', () => {
        render(<TypingIndicator visible />);

        const indicator = screen.getByTestId('typing-indicator');
        expect(indicator.props.accessibilityLabel).toBe('STEDI is typing');
        expect(indicator.props.accessibilityLiveRegion).toBe('polite');
    });
});

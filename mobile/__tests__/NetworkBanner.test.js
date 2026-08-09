import { act, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

import NetworkBanner from '../app/components/NetworkBanner';
import { MAX_FONT_SCALE } from '../app/components/Styles';

// The mock's addEventListener does not auto-invoke on subscribe (see
// network.test.js), so every connectivity change here is fired by hand.
const latestListener = () => NetInfo.addEventListener.mock.calls.at(-1)[0];

afterEach(() => {
    jest.clearAllMocks();
});

describe('network banner visibility', () => {
    it('renders nothing while online', () => {
        render(<NetworkBanner />);

        expect(screen.queryByTestId('network-banner')).toBeNull();
    });

    it('appears once the device goes offline', () => {
        render(<NetworkBanner />);

        act(() => {
            latestListener()({ isConnected: false, isInternetReachable: false });
        });

        expect(screen.getByTestId('network-banner')).toBeTruthy();
        expect(screen.getByText(/You're offline/)).toBeTruthy();
    });

    it('disappears once connectivity returns', () => {
        render(<NetworkBanner />);

        act(() => {
            latestListener()({ isConnected: false });
        });
        expect(screen.getByTestId('network-banner')).toBeTruthy();

        act(() => {
            latestListener()({ isConnected: true });
        });

        expect(screen.queryByTestId('network-banner')).toBeNull();
    });
});

describe('accessibility', () => {
    it('announces itself as a polite live region', () => {
        render(<NetworkBanner />);

        act(() => {
            latestListener()({ isConnected: false });
        });

        // No explicit accessibilityLabel: the Text's own content is already its
        // accessible name, and adding a redundant one just to attach a label
        // would need a matching accessibilityHint on a control that isn't
        // interactive (react-native-a11y/has-accessibility-hint).
        expect(screen.getByTestId('network-banner').props.accessibilityLiveRegion).toBe('polite');
        expect(screen.getByText(/You're offline/)).toBeTruthy();
    });

    it('caps its text at MAX_FONT_SCALE', () => {
        render(<NetworkBanner />);

        act(() => {
            latestListener()({ isConnected: false });
        });

        screen.UNSAFE_getAllByType(Text).forEach((node) => {
            expect(node.props.maxFontSizeMultiplier).toBe(MAX_FONT_SCALE);
        });
    });
});

import { Text, View } from 'react-native';

import { useIsOffline } from '../lib/network';
import { MAX_FONT_SCALE, useThemeStyles } from './Styles';

const OFFLINE_MESSAGE = "You're offline. Some features may not work until your connection is back.";

/**
 * Persistent banner shown while the device has no network connection.
 *
 * Mounted once, above the rest of the app (App.js), so it stays visible
 * regardless of which screen or modal is active - the chat sheet included.
 * Buttons that make network requests are deliberately left alone: `isConnected`
 * can false-negative behind a captive portal or a restrictive network, and
 * chatClient.js already surfaces a clear, retryable error on a real failure
 * (SHEET-05), so disabling on top of that would risk blocking a user who can
 * actually reach the server.
 */
export default function NetworkBanner() {
    const { styles } = useThemeStyles();
    const offline = useIsOffline();

    if (!offline) {
        return null;
    }

    return (
        <View style={styles.networkBanner} testID="network-banner" accessibilityLiveRegion="polite">
            <Text style={styles.networkBannerText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                {OFFLINE_MESSAGE}
            </Text>
        </View>
    );
}

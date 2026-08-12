import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

/**
 * Tracks whether the device currently has no network connection.
 *
 * Keyed on `isConnected`, not `isInternetReachable`: the latter can sit at
 * `null` while NetInfo is still determining reachability (common on
 * Android), and treating that transient "don't know yet" state as offline
 * would flicker the banner on ordinary screen transitions.
 *
 * @returns {boolean}
 */
export function useIsOffline() {
    const [offline, setOffline] = useState(false);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener((state) => {
            setOffline(state.isConnected === false);
        });

        return unsubscribe;
    }, []);

    return offline;
}

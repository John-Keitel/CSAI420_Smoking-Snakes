import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet } from 'react-native';

import SignUpScreen from './screens/SignUpScreen';

const styles = StyleSheet.create({
    root: {
        flex: 1,
    },
});

/**
 * Single-screen shell. No navigator: the app has one screen and the onboarding
 * chat presents as a modal over it rather than as a route, so a stack navigator
 * would add a dependency and indirection without removing any coupling.
 */
export default function App() {
    return (
        <SafeAreaView style={styles.root}>
            <StatusBar style="auto" />
            <SignUpScreen />
        </SafeAreaView>
    );
}

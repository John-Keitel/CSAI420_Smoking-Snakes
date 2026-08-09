import { useCallback, useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import ChatSheet from '../components/chat/ChatSheet';
import { MAX_FONT_SCALE, useThemeStyles } from '../components/Styles';
import { SCREEN_READER_MODE, useScreenReaderEnabled } from '../lib/accessibility';
import { createChatSessionId } from '../lib/session';

/**
 * The standard registration form, plus the conversational alternative EPIC 12
 * adds for users who cannot complete it.
 */
export default function SignUpScreen() {
    const { styles } = useThemeStyles();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [emailFocused, setEmailFocused] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);
    const [chatSessionId, setChatSessionId] = useState(null);
    const [registeredUser, setRegisteredUser] = useState(null);
    const screenReaderEnabled = useScreenReaderEnabled();

    // A session id is minted per opening rather than per mount: dismissing the
    // sheet ends that conversation, and reopening starts a fresh one (SHEET-07).
    const openChat = useCallback(() => {
        setRegisteredUser(null);
        setChatSessionId(createChatSessionId());
    }, []);

    const closeChat = useCallback(() => {
        setChatSessionId(null);
    }, []);

    // The confirmation belongs on the screen rather than inside the sheet, so it
    // survives the dismissal the success path triggers.
    const handleRegistered = useCallback((user) => {
        setRegisteredUser(user);
        setChatSessionId(null);
    }, []);

    return (
        <View style={styles.screenRoot}>
            <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
                <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Create your account
                </Text>
                <Text style={styles.subtitle} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Join STEDI to track your balance and mobility.
                </Text>

                <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Email
                </Text>
                <TextInput
                    style={[styles.textInput, emailFocused && styles.textInputFocused]}
                    value={email}
                    onChangeText={setEmail}
                    onFocus={() => setEmailFocused(true)}
                    onBlur={() => setEmailFocused(false)}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    testID="signup-email"
                    accessibilityLabel="Email address"
                    accessibilityHint="Enter the email address for your account"
                />

                <Text style={styles.label} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                    Password
                </Text>
                <TextInput
                    style={[styles.textInput, passwordFocused && styles.textInputFocused]}
                    value={password}
                    onChangeText={setPassword}
                    onFocus={() => setPasswordFocused(true)}
                    onBlur={() => setPasswordFocused(false)}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    testID="signup-password"
                    accessibilityLabel="Password"
                    accessibilityHint="Enter a password for your account"
                />

                <TouchableOpacity
                    style={styles.button}
                    testID="signup-submit"
                    accessibilityRole="button"
                    accessibilityLabel="Sign up"
                    accessibilityHint="Creates your account"
                >
                    <Text style={styles.buttonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                        Sign up
                    </Text>
                </TouchableOpacity>

                {registeredUser === null ? null : (
                    <Text
                        style={styles.successText}
                        testID="signup-success"
                        accessibilityLiveRegion="polite"
                        maxFontSizeMultiplier={MAX_FONT_SCALE}
                    >
                        Account created for {registeredUser.email}. You can sign in now.
                    </Text>
                )}

                <View style={styles.helpRow}>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={openChat}
                        testID="need-help-button"
                        accessibilityRole="button"
                        accessibilityLabel="Need help? Sign up by chat instead"
                        accessibilityHint="Opens a chat that walks you through creating your account"
                    >
                        <Text style={styles.secondaryButtonText} maxFontSizeMultiplier={MAX_FONT_SCALE}>
                            Need Help?
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <ChatSheet
                visible={chatSessionId !== null}
                chatSessionId={chatSessionId}
                onDismiss={closeChat}
                onRegistered={handleRegistered}
                onRestart={openChat}
                accessibilityMode={screenReaderEnabled ? SCREEN_READER_MODE : null}
            />
        </View>
    );
}

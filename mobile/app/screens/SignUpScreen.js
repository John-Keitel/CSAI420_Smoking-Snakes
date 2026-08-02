import { useCallback, useState } from 'react';
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useThemeStyles } from '../components/Styles';
import { createChatSessionId } from '../lib/session';

/**
 * The standard registration form, plus the conversational alternative EPIC 12
 * adds for users who cannot complete it.
 */
export default function SignUpScreen() {
    const { styles } = useThemeStyles();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [chatSessionId, setChatSessionId] = useState(null);

    // A session id is minted per opening rather than per mount: dismissing the
    // sheet ends that conversation, and reopening starts a fresh one (SHEET-07).
    const openChat = useCallback(() => {
        setChatSessionId(createChatSessionId());
    }, []);

    const closeChat = useCallback(() => {
        setChatSessionId(null);
    }, []);

    return (
        <View style={styles.screenRoot}>
            <ScrollView contentContainerStyle={styles.screen} keyboardShouldPersistTaps="handled">
                <Text style={styles.title}>Create your account</Text>
                <Text style={styles.subtitle}>Join STEDI to track your balance and mobility.</Text>

                <Text style={styles.label}>Email</Text>
                <TextInput
                    style={styles.textInput}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="emailAddress"
                    testID="signup-email"
                />

                <Text style={styles.label}>Password</Text>
                <TextInput
                    style={styles.textInput}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    testID="signup-password"
                />

                <TouchableOpacity style={styles.button} testID="signup-submit">
                    <Text style={styles.buttonText}>Sign up</Text>
                </TouchableOpacity>

                <View style={styles.helpRow}>
                    <TouchableOpacity
                        style={styles.secondaryButton}
                        onPress={openChat}
                        testID="need-help-button"
                        accessibilityRole="button"
                        accessibilityLabel="Need help? Sign up by chat instead"
                        accessibilityHint="Opens a chat that walks you through creating your account"
                    >
                        <Text style={styles.secondaryButtonText}>Need Help?</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            <Modal
                visible={chatSessionId !== null}
                animationType="slide"
                transparent
                onRequestClose={closeChat}
                testID="chat-sheet"
            >
                <View style={styles.backdrop}>
                    <View style={styles.sheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>Sign up assistant</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={closeChat}
                                testID="chat-close-button"
                                accessibilityRole="button"
                                accessibilityLabel="Close the sign up assistant"
                            >
                                <Text style={styles.closeButtonText}>Done</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

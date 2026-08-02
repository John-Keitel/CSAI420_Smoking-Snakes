import { useState } from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { useThemeStyles } from '../components/Styles';

/**
 * The standard registration form. EPIC 12 adds a conversational alternative for
 * users who cannot complete it; that entry point arrives in T2.
 */
export default function SignUpScreen() {
    const { styles } = useThemeStyles();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    return (
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

            <View>
                <TouchableOpacity style={styles.button} testID="signup-submit">
                    <Text style={styles.buttonText}>Sign up</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

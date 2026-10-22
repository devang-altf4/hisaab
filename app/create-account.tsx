import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { font } from '../src/theme/fonts';
import {
  CredentialFields,
  ErrorLine,
  PrimaryButton,
  TextButton,
  Title,
  looksLikeEmail,
  ob,
} from '../src/onboarding/kit';

/**
 * Last onboarding step: the guest account gets an email + password. Everything set up so far
 * (profile, budget, anything logged) stays with it. The root layout then opens the app.
 */
export default function CreateAccountScreen() {
  const { user, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!looksLikeEmail(email)) return setError('Enter a valid email address.');
    if (password.length < 8) return setError('Use at least 8 characters for your password.');
    setBusy(true);
    try {
      await register(email, password);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t create your account. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const firstName = user?.name && user.name !== 'Friend' ? user.name : null;

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.headerSpacer} />
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title
            title={firstName ? `Save your progress, ${firstName}` : 'Save your progress'}
            subtitle="Create an account to sign in on any phone and share your log with a trainer."
          />
          <CredentialFields
            email={email}
            password={password}
            onEmail={setEmail}
            onPassword={setPassword}
            onSubmit={() => void submit()}
            newPassword
          />
          <ErrorLine text={error} />
          {user?.targets ? (
            <Text style={styles.note}>
              Your {user.targets.calories.toLocaleString()} kcal daily budget is saved to this account.
            </Text>
          ) : null}
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Create Account" loading={busy} onPress={() => void submit()} />
          <TextButton label="I already have an account" onPress={() => router.push('/sign-in')} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ob.bg },
  flex: { flex: 1 },
  headerSpacer: { height: 52 },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  note: {
    fontFamily: font.regular,
    fontSize: 15,
    lineHeight: 21,
    color: ob.secondary,
    marginTop: 16,
    marginLeft: 16,
  },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
});

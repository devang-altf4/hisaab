import React, { useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../src/auth/AuthContext';
import { CredentialFields, ErrorLine, PrimaryButton, Title, looksLikeEmail, ob } from '../src/onboarding/kit';

/** Email + password sign-in. On success the root layout takes the user into the app. */
export default function SignInScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!looksLikeEmail(email)) return setError('Enter the email you signed up with.');
    if (!password) return setError('Enter your password.');
    setBusy(true);
    try {
      // Replaces any half-finished guest session on this phone only once the password is right.
      await signIn(email, password);
    } catch (err: any) {
      setError(err?.message || 'Couldn’t sign in. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const back = () => (router.canGoBack() ? router.back() : router.replace('/onboarding'));

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <View style={styles.header}>
          <Pressable onPress={back} hitSlop={12} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
            <ChevronLeft size={28} color={ob.label} strokeWidth={2.4} />
          </Pressable>
        </View>
        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Title title="Welcome back" subtitle="Sign in with your email and password." />
          <CredentialFields
            email={email}
            password={password}
            onEmail={setEmail}
            onPassword={setPassword}
            onSubmit={() => void submit()}
          />
          <ErrorLine text={error} />
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton label="Sign In" loading={busy} onPress={() => void submit()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ob.bg },
  flex: { flex: 1 },
  header: { height: 52, justifyContent: 'center', paddingHorizontal: 12 },
  backBtn: { width: 44, height: 44, justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
});

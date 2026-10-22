import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { API_BASE_URL } from '../src/api/client';
import { StatusBar } from 'expo-status-bar';
import { Stack, router, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import { colors } from '../src/theme/tokens';
import { useFonts } from 'expo-font';
import { font, fontAssets } from '../src/theme/fonts';
import {
  registerPushToken,
  syncNotificationSchedule,
  setupNotificationResponseListener,
} from '../src/notifications/notificationService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
      refetchOnWindowFocus: true,
    },
  },
});

function RootNavigation() {
  const { isLoading, isOnboarded, user, error, bootstrap } = useAuth();
  const segments = useSegments();
  const notificationsPerDay = user?.notificationsPerDay;

  // Signed out → welcome (onboarding step 0) or sign-in. Guest → onboarding, then "Create your
  // account". Account → the app. Onboarding moves itself to create-account at its end, so it is
  // never yanked away mid-flow the moment the profile is saved.
  const hasAccount = Boolean(user?.email);
  useEffect(() => {
    if (isLoading) return;
    const seg = segments[0] as string | undefined;
    // Clear the stack first, so Back can't return to a screen from the previous state
    // (e.g. onboarding under the app after signing in).
    const go = (path: string) => {
      if (router.canDismiss()) router.dismissAll();
      router.replace(path as any);
    };

    if (!user) {
      if (seg !== 'onboarding' && seg !== 'sign-in') go('/onboarding');
    } else if (!isOnboarded) {
      if (seg !== 'onboarding' && seg !== 'sign-in') go('/onboarding');
    } else if (!hasAccount) {
      if (seg !== 'create-account' && seg !== 'onboarding' && seg !== 'sign-in') go('/create-account');
    } else if (seg === 'onboarding' || seg === 'sign-in' || seg === 'create-account') {
      go('/(tabs)');
    }
  }, [isLoading, user, isOnboarded, hasAccount, segments]);

  useEffect(() => {
    const unsub = setupNotificationResponseListener();
    return () => unsub();
  }, []);

  // Only after login + onboarding: before that there's no token (calls would 401 and
  // race the bootstrap guest login), and onboarding owns the permission pre-prompt.
  useEffect(() => {
    if (isLoading || !isOnboarded || notificationsPerDay === undefined) return;
    void registerPushToken();
    void syncNotificationSchedule(notificationsPerDay);
  }, [isLoading, isOnboarded, notificationsPerDay]);

  // Login failed (server down, wrong IP, phone on another Wi-Fi): say so instead of a blank screen.
  if (!isLoading && !user && error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Can't reach Hisaab</Text>
        <Text style={styles.errorBody}>
          Check that the server is running and this phone is on the same Wi-Fi.{'\n'}
          {API_BASE_URL}
        </Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => void bootstrap()}>
          <Text style={styles.retryText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="sign-in" options={{ headerShown: false, animation: 'slide_from_right' }} />
        <Stack.Screen name="create-account" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen
          name="capture"
          options={{
            presentation: 'fullScreenModal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="meal/[id]"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen
          name="paywall"
          options={{
            presentation: 'modal',
            headerShown: false,
            animation: 'slide_from_bottom',
          }}
        />
        <Stack.Screen name="trainer/[clientId]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  // Hold the first frame until Mukta is ready so text never flashes in the system font.
  // If loading fails we still render (system font fallback) rather than block the app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  if (!fontsLoaded && !fontError) return <View style={styles.loadingContainer} />;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RootNavigation />
      </AuthProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  errorTitle: { color: '#FFFFFF', fontFamily: font.bold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, textAlign: 'center' },
  errorBody: { color: '#8E8E93', fontFamily: font.regular, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 6, marginHorizontal: 32 },
  retryBtn: { marginTop: 28, backgroundColor: '#FFFFFF', paddingHorizontal: 40, paddingVertical: 14, borderRadius: 28 },
  retryText: { color: '#000000', fontFamily: font.bold, fontSize: 17 },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

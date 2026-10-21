import React from 'react';
import { View, StyleSheet } from 'react-native';
import { PaywallModal } from '../src/components/PaywallModal';
import { router, useLocalSearchParams } from 'expo-router';

export default function PaywallScreen() {
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  return (
    <View style={styles.container}>
      <PaywallModal
        visible={true}
        reason={reason}
        onClose={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});


import React from 'react';
import { Tabs, router } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { Home, LineChart, Plus, MessageSquare, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textDim,
        tabBarStyle: {
          backgroundColor: colors.bg,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 58 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: font.medium,
          fontSize: 11,
          letterSpacing: -0.1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Home size={22} color={color} strokeWidth={2} />,
        }}
      />

      <Tabs.Screen
        name="hisaab"
        options={{
          title: 'Ledger',
          tabBarIcon: ({ color }) => <LineChart size={22} color={color} strokeWidth={2} />,
        }}
      />

      {/* Floating Center + Button */}
      <Tabs.Screen
        name="capture-placeholder"
        options={{
          title: '',
          tabBarButton: () => (
            <TouchableOpacity
              style={styles.floatingPlusBtn}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Capture meal"
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/capture' as any);
              }}
            >
              <View style={styles.floatingInner}>
                <Plus size={28} color="#000000" strokeWidth={2.4} />
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color }) => <MessageSquare size={22} color={color} strokeWidth={2} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <User size={22} color={color} strokeWidth={2} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingPlusBtn: {
    top: -14,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  floatingInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

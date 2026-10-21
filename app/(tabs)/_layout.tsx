import React from 'react';
import { Tabs, router } from 'expo-router';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { colors, radii } from '../../src/theme/tokens';
import { Home, LineChart, Plus, MessageSquare, User } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  // Android is edge-to-edge: the tab bar must sit above the gesture/3-button nav bar.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 8);
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.profit,
        tabBarInactiveTintColor: colors.textMute,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: 60 + bottomPad,
          paddingBottom: bottomPad,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Home size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="hisaab"
        options={{
          title: 'Ledger',
          tabBarIcon: ({ color, size }) => <LineChart size={22} color={color} />,
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
              activeOpacity={0.8}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                router.push('/capture' as any);
              }}
            >
              <View style={styles.floatingInner}>
                <Plus size={26} color="#000" strokeWidth={2.8} />
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      <Tabs.Screen
        name="coach"
        options={{
          title: 'Coach',
          tabBarIcon: ({ color, size }) => <MessageSquare size={22} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  floatingPlusBtn: {
    top: -18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  floatingInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.profit,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.profit,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: colors.bg,
  },
});

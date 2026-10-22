import React, { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme/tokens';
import { font } from '../theme/fonts';

/** The label moves on while the wait goes on, so a slow answer still feels like progress. */
const STAGES: [number, string][] = [
  [0, 'Thinking'],
  [4000, 'Checking your numbers'],
  [10000, 'Almost there'],
];

/** Shown from the moment a message is sent until the coach replies (the AI can take 5–15 s). */
export function ThinkingIndicator() {
  const [dots] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [label, setLabel] = useState(STAGES[0][1]);

  useEffect(() => {
    const timers = STAGES.slice(1).map(([at, text]) => setTimeout(() => setLabel(text), at));
    return () => timers.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      const bounce = (v: Animated.Value) =>
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]);
      loop = Animated.loop(Animated.sequence([Animated.stagger(150, dots.map(bounce)), Animated.delay(250)]));
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [dots]);

  return (
    <View style={styles.row} accessible accessibilityLabel={`Coach: ${label}`} accessibilityLiveRegion="polite">
      <View style={styles.dots}>
        {dots.map((v, i) => (
          <Animated.View
            key={i}
            style={[
              styles.dot,
              {
                opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
                transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
              },
            ]}
          />
        ))}
      </View>
      <Text style={styles.label}>{label}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 16 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.text },
  label: { fontFamily: font.medium, fontSize: 15, color: colors.textDim, letterSpacing: -0.2 },
});

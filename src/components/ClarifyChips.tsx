import React, { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { colors, radii, spacing } from '../theme/tokens';
import { useClarifyMeal } from '../api/queries';
import type { Meal } from '../api/hisaabApi';

interface ClarifyChipsProps {
  meal: Meal;
  /** Compact = inline under the meal name on Home; full = card on the meal screen. */
  variant?: 'compact' | 'card';
}

/**
 * P1 "How many skewers?" — one line + tap-to-answer chips. The AI's guess is pre-selected;
 * tapping another number recalculates instantly on the server (no AI call, no scan used).
 */
export const ClarifyChips: React.FC<ClarifyChipsProps> = ({ meal, variant = 'compact' }) => {
  const clarify = meal.clarify;
  const mutation = useClarifyMeal();
  const [pending, setPending] = useState<number | null>(null);
  if (!clarify) return null;

  const answer = (pieces: number) => {
    if (mutation.isPending) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPending(pieces);
    mutation.mutate(
      { id: meal.id, pieces, ingredientIndex: clarify.ingredientIndex },
      {
        onSuccess: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
        onError: (err: any) => Alert.alert('Couldn’t update', err?.message || 'Try again.'),
        onSettled: () => setPending(null),
      },
    );
  };

  const selected = pending ?? clarify.current;
  const isCard = variant === 'card';

  return (
    <View style={isCard ? styles.card : styles.compact}>
      <Text style={isCard ? styles.questionCard : styles.questionCompact}>{clarify.question}</Text>
      <View style={styles.chipsRow} accessibilityRole="radiogroup">
        {clarify.options.map((n) => {
          const on = n === selected;
          const saving = mutation.isPending && pending === n;
          return (
            <Pressable
              key={n}
              accessibilityRole="radio"
              accessibilityState={{ checked: on, busy: saving }}
              accessibilityLabel={`${n} ${n === 1 ? clarify.unit : clarify.unit + 's'}`}
              onPress={() => answer(n)}
              hitSlop={4}
              style={({ pressed }) => [
                styles.chip,
                isCard && styles.chipLarge,
                on && styles.chipOn,
                pressed && !on && styles.chipPressed,
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#000" />
              ) : (
                <Text style={[styles.chipText, isCard && styles.chipTextLarge, on && styles.chipTextOn]}>{n}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
      {isCard ? (
        <Text style={styles.hint}>
          We guessed {clarify.current}. Tap the right number and we’ll recalculate.
        </Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  compact: { marginTop: 8, gap: 6 },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    padding: spacing.lg,
    gap: 10,
  },
  questionCompact: { fontSize: 13, fontWeight: '600', color: colors.accent },
  questionCard: { fontSize: 17, fontWeight: '700', color: colors.text },
  chipsRow: { flexDirection: 'row', gap: 8 },
  chip: {
    minWidth: 36,
    height: 30,
    paddingHorizontal: 10,
    borderRadius: radii.pill,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLarge: { minWidth: 48, height: 40 },
  chipOn: { backgroundColor: colors.text, borderColor: colors.text },
  chipPressed: { backgroundColor: colors.border },
  chipText: { fontSize: 14, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  chipTextLarge: { fontSize: 16 },
  chipTextOn: { color: '#000' },
  hint: { fontSize: 13, color: colors.textDim, lineHeight: 18 },
});

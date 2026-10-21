import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
import { api } from '../api/client';
import { AlertCircle, Utensils } from 'lucide-react-native';
import { useRetryMeal } from '../api/queries';
import type { Meal } from '../api/hisaabApi';
import { router } from 'expo-router';
import { ClarifyChips } from './ClarifyChips';

interface MealCardProps {
  meal: Meal;
  onPress?: () => void;
  onDescribeInstead?: () => void;
  /** Trainer view: no navigation, no retry (those endpoints are owner-only). */
  readOnly?: boolean;
}

export const MealCard: React.FC<MealCardProps> = ({ meal, onPress, onDescribeInstead, readOnly }) => {
  const retryMutation = useRetryMeal();

  const handleRetry = () => {
    retryMutation.mutate({ id: meal.id });
  };

  const handleCardPress = () => {
    if (readOnly) return;
    if (meal.status === 'done') {
      if (onPress) {
        onPress();
      } else {
        router.push(`/meal/${meal.id}` as any);
      }
    }
  };

  // 1. Analyzing state
  if (meal.status === 'analyzing') {
    return (
      <View style={styles.row}>
        <View style={styles.thumbnailPlaceholder}>
          <ActivityIndicator color={colors.textDim} size="small" />
        </View>
        <View style={styles.centerCol}>
          <Text style={styles.analyzingText}>Analyzing your meal…</Text>
          <Text style={styles.analyzingSub}>Checking ingredients and calories</Text>
        </View>
      </View>
    );
  }

  // 2. Failed state
  if (meal.status === 'failed') {
    return (
      <View style={styles.row}>
        <View style={[styles.thumbnailPlaceholder, { backgroundColor: 'rgba(255, 69, 58, 0.12)' }]}>
          <AlertCircle size={22} color={colors.loss} />
        </View>
        <View style={styles.centerCol}>
          <Text style={styles.failedTitle}>Couldn’t read this meal</Text>
          {!readOnly && (
            <View style={styles.failedActionsRow}>
              <TouchableOpacity
                onPress={handleRetry}
                disabled={retryMutation.isPending}
                hitSlop={6}
              >
                <Text style={styles.failedActionText}>
                  {retryMutation.isPending ? 'Retrying…' : 'Retry'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.failedDot}>·</Text>
              {onDescribeInstead && (
                <TouchableOpacity onPress={onDescribeInstead} hitSlop={6}>
                  <Text style={styles.failedActionText}>Describe instead</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }

  // 3. Normal / Done state
  const imgUrl = api.resolveImageUrl(meal.imageUrl);
  const timeFormatted = meal.loggedAt
    ? new Date(meal.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';

  const mealTypeFormatted = meal.mealType
    ? meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)
    : '';

  const subline = [mealTypeFormatted, timeFormatted].filter(Boolean).join(', ');

  // Format P&L tag (+28 or -120)
  let pnlTag: string | null = null;
  let pnlIsProfit = true;
  if (meal.hisaab) {
    pnlIsProfit = meal.hisaab.status === 'PROFIT';
    const sign = pnlIsProfit ? '+' : '−';
    pnlTag = `${sign}${Math.abs(meal.hisaab.amount)}`;
  }

  return (
    <TouchableOpacity
      style={styles.row}
      activeOpacity={readOnly ? 1 : 0.7}
      onPress={handleCardPress}
      disabled={readOnly}
    >
      {/* 56 pt rounded photo thumbnail */}
      {imgUrl ? (
        <Image source={{ uri: imgUrl }} style={styles.thumbnail} resizeMode="cover" />
      ) : (
        <View style={styles.thumbnailPlaceholder}>
          <Utensils size={20} color={colors.textMute} />
        </View>
      )}

      {/* Center column: Name + Subline + Question chips */}
      <View style={styles.centerCol}>
        <Text style={styles.mealName} numberOfLines={1}>
          {meal.dishName}
        </Text>
        <Text style={styles.mealSubline}>{subline}</Text>
        {!readOnly && meal.clarify ? <ClarifyChips meal={meal} variant="compact" /> : null}
      </View>

      {/* Right column: Calories + P&L tag, and macro line */}
      <View style={styles.rightCol}>
        <View style={styles.kcalRow}>
          <Text style={styles.kcalText}>{meal.calories} kcal</Text>
          {pnlTag ? (
            <View
              style={[
                styles.pnlTagPill,
                { backgroundColor: pnlIsProfit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255, 69, 58, 0.15)' },
              ]}
            >
              <Text
                style={[
                  styles.pnlTagText,
                  { color: pnlIsProfit ? colors.profit : colors.loss },
                ]}
              >
                {pnlTag}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.macroLine}>
          P {meal.proteinG} · C {meal.carbsG} · F {meal.fatG}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    minHeight: 76,
    gap: 12,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  thumbnailPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerCol: {
    flex: 1,
    justifyContent: 'center',
  },
  mealName: {
    fontFamily: font.semibold,
    fontSize: 16,
    lineHeight: 21,
    color: colors.text,
    letterSpacing: -0.3,
  },
  mealSubline: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 18,
    color: colors.textDim,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  kcalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  kcalText: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  pnlTagPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pnlTagText: {
    fontFamily: font.semibold,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  macroLine: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textMute,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  analyzingText: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
  analyzingSub: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  failedTitle: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.loss,
    letterSpacing: -0.2,
  },
  failedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  failedActionText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.textDim,
  },
  failedDot: {
    color: colors.textMute,
  },
});

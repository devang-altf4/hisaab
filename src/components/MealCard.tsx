import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { api } from '../api/client';
import { PnlBadge } from './PnlBadge';
import { Clock, RefreshCw, AlertCircle, Utensils } from 'lucide-react-native';
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

  // 1. Analyzing state (skeleton card)
  if (meal.status === 'analyzing') {
    return (
      <View style={[styles.card, styles.analyzingCard]}>
        <View style={styles.skeletonThumbnail}>
          <ActivityIndicator color={colors.accent} size="small" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.analyzingTitle}>Analyzing your meal…</Text>
          <Text style={styles.analyzingSub}>This takes a few seconds</Text>
          <View style={styles.skeletonBar} />
        </View>
      </View>
    );
  }

  // 2. Failed state
  if (meal.status === 'failed') {
    return (
      <View style={[styles.card, styles.failedCard]}>
        <View style={styles.failedIconContainer}>
          <AlertCircle size={24} color={colors.loss} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.failedTitle}>Couldn’t read this meal</Text>
          <Text style={styles.failedSub}>{meal.error || 'Retry, or describe it instead.'}</Text>
          {!readOnly && <View style={styles.failedActionRow}>
            <TouchableOpacity style={styles.actionBtnSmall} onPress={handleRetry} disabled={retryMutation.isPending}>
              <RefreshCw size={12} color={colors.text} />
              <Text style={styles.actionBtnText}>Retry</Text>
            </TouchableOpacity>
            {onDescribeInstead && (
              <TouchableOpacity style={[styles.actionBtnSmall, styles.actionBtnAlt]} onPress={onDescribeInstead}>
                <Text style={styles.actionBtnText}>Describe instead</Text>
              </TouchableOpacity>
            )}
          </View>}
        </View>
      </View>
    );
  }

  // 3. Done state
  const imgUrl = api.resolveImageUrl(meal.imageUrl);
  const timeFormatted = meal.loggedAt
    ? new Date(meal.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <TouchableOpacity style={styles.card} activeOpacity={readOnly ? 1 : 0.7} onPress={handleCardPress} disabled={readOnly}>
      {/* Thumbnail */}
      <View style={styles.thumbnailContainer}>
        {imgUrl ? (
          <Image source={{ uri: imgUrl }} style={styles.thumbnail} resizeMode="cover" />
        ) : (
          <View style={styles.placeholderThumbnail}>
            <Utensils size={20} color={colors.textMute} />
          </View>
        )}
        {meal.healthScore ? (
          <View style={styles.healthScoreBadge}>
            <Text style={styles.healthScoreText}>{meal.healthScore}/10</Text>
          </View>
        ) : null}
      </View>

      {/* Details */}
      <View style={styles.cardContent}>
        <View style={styles.topRow}>
          <Text style={styles.dishName} numberOfLines={1}>
            {meal.dishName}
          </Text>
          <Text style={styles.caloriesText}>{meal.calories} kcal</Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.timeRow}>
            <Clock size={11} color={colors.textMute} />
            <Text style={styles.timeText}>{timeFormatted}</Text>
          </View>
          <Text style={styles.mealTypeTag}>{meal.mealType.toUpperCase()}</Text>
          {meal.servings && meal.servings !== 1 ? (
            <Text style={styles.servingsTag}>{meal.servings}x</Text>
          ) : null}
        </View>

        {/* P1: "How many skewers?" — answer right here, no need to open the meal */}
        {!readOnly && meal.clarify ? <ClarifyChips meal={meal} /> : null}

        {/* Macro pills */}
        <View style={styles.macroPillsRow}>
          <View style={[styles.macroPill, { backgroundColor: 'rgba(248, 113, 113, 0.15)' }]}>
            <Text style={[styles.macroPillText, { color: colors.protein }]}>P {meal.proteinG}g</Text>
          </View>
          <View style={[styles.macroPill, { backgroundColor: 'rgba(251, 191, 36, 0.15)' }]}>
            <Text style={[styles.macroPillText, { color: colors.carbs }]}>C {meal.carbsG}g</Text>
          </View>
          <View style={[styles.macroPill, { backgroundColor: 'rgba(96, 165, 250, 0.15)' }]}>
            <Text style={[styles.macroPillText, { color: colors.fat }]}>F {meal.fatG}g</Text>
          </View>
        </View>

        {/* Per-meal PnL tag */}
        {meal.hisaab && (
          <View style={styles.pnlRow}>
            <PnlBadge pnl={meal.hisaab} size="sm" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  thumbnailContainer: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: colors.cardAlt,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  placeholderThumbnail: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.cardAlt,
  },
  healthScoreBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  healthScoreText: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.text,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  dishName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  caloriesText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMute,
  },
  mealTypeTag: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  servingsTag: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accent,
  },
  macroPillsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  macroPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  macroPillText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  pnlRow: {
    marginTop: 8,
  },
  // Analyzing skeleton
  analyzingCard: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: '#181612',
  },
  skeletonThumbnail: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accent,
  },
  analyzingSub: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 4,
  },
  skeletonBar: {
    height: 4,
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderRadius: 2,
    marginTop: 10,
    width: '60%',
  },
  // Failed card
  failedCard: {
    borderColor: 'rgba(239, 68, 68, 0.3)',
    backgroundColor: '#1A1212',
  },
  failedIconContainer: {
    width: 76,
    height: 76,
    borderRadius: radii.md,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  failedTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.loss,
  },
  failedSub: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 4,
  },
  failedActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.button,
    gap: 4,
  },
  actionBtnAlt: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.text,
  },
});


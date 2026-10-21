import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { Droplet, Flame, Plus, RotateCcw } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useLogWater, useDeleteLastWater } from '../api/queries';
import type { DaySummary } from '../api/hisaabApi';

interface TrackersRowProps {
  summary: DaySummary;
  onOpenWorkout: () => void;
}

export const TrackersRow: React.FC<TrackersRowProps> = ({ summary, onOpenWorkout }) => {
  const logWaterMutation = useLogWater();
  const deleteWaterMutation = useDeleteLastWater();

  const handleWaterTap = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    logWaterMutation.mutate({ ml: 250, date: summary.date });
  };

  const handleWaterLongPress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    deleteWaterMutation.mutate(summary.date);
  };

  const waterProgress = Math.min(Math.max(summary.water.progress, 0), 1);
  const targetLiters = (summary.water.targetMl / 1000).toFixed(1);
  const currentLiters = (summary.water.ml / 1000).toFixed(1);

  return (
    <View style={styles.container}>
      {/* Water Card */}
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.8}
        onPress={handleWaterTap}
        onLongPress={handleWaterLongPress}
        delayLongPress={500}
      >
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
            <Droplet size={18} color={colors.water} />
          </View>
          <View style={styles.badgeAction}>
            <Plus size={12} color={colors.water} />
            <Text style={styles.addText}>250ml</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.valueText}>{summary.water.ml} ml</Text>
          <Text style={styles.targetText}>of {summary.water.targetMl} ml target</Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${waterProgress * 100}%`, backgroundColor: colors.water }]} />
        </View>
        <Text style={styles.hintText}>Tap +250ml · Hold to undo</Text>
      </TouchableOpacity>

      {/* Exercise Card */}
      <TouchableOpacity style={styles.card} activeOpacity={0.8} onPress={onOpenWorkout}>
        <View style={styles.cardHeader}>
          <View style={[styles.iconCircle, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Flame size={18} color={colors.accent} />
          </View>
          <View style={[styles.badgeAction, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
            <Plus size={12} color={colors.accent} />
            <Text style={[styles.addText, { color: colors.accent }]}>Log</Text>
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.valueText}>+{summary.burned} kcal</Text>
          <Text style={styles.targetText}>{summary.counts.workouts} workouts today</Text>
        </View>

        <View style={styles.progressBarTrack}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min((summary.burned / 500) * 100, 100)}%`,
                backgroundColor: colors.accent,
              },
            ]}
          />
        </View>
        <Text style={styles.hintText}>Bonus credit added</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
    gap: 3,
  },
  addText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.water,
  },
  content: {
    marginBottom: spacing.sm,
  },
  valueText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  targetText: {
    fontSize: 11,
    color: colors.textMute,
    marginTop: 2,
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: colors.cardAlt,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  hintText: {
    fontSize: 10,
    color: colors.textMute,
  },
});


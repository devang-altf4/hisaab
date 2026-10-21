import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
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

  const currentL = (summary.water.ml / 1000).toFixed(2);
  const targetL = (summary.water.targetMl / 1000).toFixed(2);
  const workoutCount = summary.counts?.workouts ?? 0;

  return (
    <View style={styles.container}>
      {/* Water Tile */}
      <View style={styles.tile}>
        <View style={styles.tileHeader}>
          <Text style={styles.tileTitle}>Water</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={handleWaterTap}
            onLongPress={handleWaterLongPress}
            delayLongPress={500}
            accessibilityRole="button"
            accessibilityLabel="Add 250 ml water, long press to undo"
          >
            <Text style={styles.actionBtnText}>+250 ml</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.tileValue}>
          {currentL} of {targetL} L
        </Text>
      </View>

      {/* Exercise Tile */}
      <View style={styles.tile}>
        <View style={styles.tileHeader}>
          <Text style={styles.tileTitle}>Exercise</Text>
          <TouchableOpacity
            style={styles.actionBtn}
            activeOpacity={0.7}
            onPress={onOpenWorkout}
            accessibilityRole="button"
            accessibilityLabel="Log workout"
          >
            <Text style={styles.actionBtnText}>Log</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.tileValue}>
          {summary.burned} kcal burned, {workoutCount} workout{workoutCount === 1 ? '' : 's'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    justifyContent: 'space-between',
    minHeight: 90,
  },
  tileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  tileTitle: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.textDim,
    letterSpacing: -0.2,
  },
  actionBtn: {
    backgroundColor: colors.control,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  actionBtnText: {
    fontFamily: font.semibold,
    fontSize: 13,
    color: colors.text,
    letterSpacing: -0.1,
  },
  tileValue: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
    fontVariant: ['tabular-nums'],
  },
});

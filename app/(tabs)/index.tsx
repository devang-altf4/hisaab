import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { HisaabCard } from '../../src/components/HisaabCard';
import { MacroRingsRow } from '../../src/components/MacroRing';
import { TrackersRow } from '../../src/components/TrackersRow';
import { MealCard } from '../../src/components/MealCard';
import { WorkoutModal } from '../../src/components/WorkoutModal';
import { useDashboard, useServerHealth } from '../../src/api/queries';
import { daysAgoKey } from '../../src/lib/dates';
import { router } from 'expo-router';
import { Flame, Camera, Plus, Sparkles } from 'lucide-react-native';

export default function HomeScreen() {
  // 'today' vs 'yesterday'
  const [isYesterday, setIsYesterday] = useState(false);
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);

  const selectedDate = useMemo(() => {
    if (!isYesterday) return undefined; // defaults to today on server
    return daysAgoKey(1);
  }, [isYesterday]);

  const { data, isLoading, isRefetching, refetch } = useDashboard(selectedDate);
  const { data: health } = useServerHealth();
  const aiNotice =
    health?.aiStatus === 'error'
      ? 'AI isn’t working, so meal photos will fail. Check the AI key on the server.'
      : health?.aiMode === 'mock'
        ? 'Demo mode: AI isn’t connected, so photo results are samples, not your food.'
        : null;

  const summary = data?.summary;
  const streak = data?.streak ?? 0;
  const meals = data?.meals ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.brandTitle}>Hisaab</Text>
          {streak > 0 && (
            <View style={styles.streakBadge}>
              <Flame size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.streakText}>{streak} day streak</Text>
            </View>
          )}
        </View>

        {/* Today | Yesterday Segmented Toggle */}
        <View style={styles.segmentedToggle}>
          <TouchableOpacity
            style={[styles.segmentBtn, !isYesterday && styles.segmentBtnActive]}
            onPress={() => setIsYesterday(false)}
          >
            <Text style={[styles.segmentText, !isYesterday && styles.segmentTextActive]}>Today</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, isYesterday && styles.segmentBtnActive]}
            onPress={() => setIsYesterday(true)}
          >
            <Text style={[styles.segmentText, isYesterday && styles.segmentTextActive]}>Yesterday</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => { void refetch(); }}
            tintColor={colors.accent}
          />
        }
      >
        {isLoading && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : summary ? (
          <>
            {/* Main Hisaab Card */}
            {aiNotice ? (
              <View style={styles.aiNotice} accessibilityRole="alert">
                <Text style={styles.aiNoticeText}>{aiNotice}</Text>
              </View>
            ) : null}
            <HisaabCard summary={summary} />

            {/* Macro Breakdown Rings */}
            <MacroRingsRow macros={summary.macros} />

            {/* Quick Trackers: Water & Exercise */}
            <TrackersRow
              summary={summary}
              onOpenWorkout={() => setWorkoutModalVisible(true)}
            />

            {/* Recently Uploaded Meals Section */}
            <View style={styles.mealsSection}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Recently Uploaded</Text>
                <TouchableOpacity
                  style={styles.addMealShortcut}
                  onPress={() => router.push('/capture' as any)}
                >
                  <Plus size={14} color={colors.accent} />
                  <Text style={styles.addMealShortcutText}>Scan Meal</Text>
                </TouchableOpacity>
              </View>

              {meals.length === 0 ? (
                <TouchableOpacity
                  style={styles.emptyStateCard}
                  activeOpacity={0.8}
                  onPress={() => router.push('/capture' as any)}
                >
                  <Text style={styles.emptyEmoji}>📸</Text>
                  <Text style={styles.emptyTitle}>Nothing logged yet today</Text>
                  <Text style={styles.emptySub}>
                    Snap a photo of your meal or describe it.
                  </Text>
                  <View style={styles.emptyCta}>
                    <Camera size={16} color="#000" />
                    <Text style={styles.emptyCtaText}>Log a Meal</Text>
                  </View>
                </TouchableOpacity>
              ) : (
                meals.map((meal) => (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    onDescribeInstead={() => router.push('/capture' as any)}
                  />
                ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Workout Logger Sheet / Modal */}
      <WorkoutModal
        visible={workoutModalVisible}
        onClose={() => setWorkoutModalVisible(false)}
        date={selectedDate}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    letterSpacing: -0.5,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
    gap: 4,
  },
  streakText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.accent,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.cardAlt,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMute,
  },
  segmentTextActive: {
    color: colors.text,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  aiNotice: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.35)',
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  aiNoticeText: { color: colors.accent, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  centerLoading: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsSection: {
    marginTop: spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  addMealShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addMealShortcutText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
  },
  emptyStateCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderStyle: 'dashed',
    padding: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyEmoji: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptySub: {
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  emptyCta: {
    backgroundColor: colors.accent,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radii.button,
    gap: 6,
  },
  emptyCtaText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000',
  },
});

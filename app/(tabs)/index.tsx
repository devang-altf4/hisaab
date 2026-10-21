import React, { useState, useEffect } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { colors, radii } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { HisaabCard } from '../../src/components/HisaabCard';
import { MacroRingsRow } from '../../src/components/MacroRing';
import { TrackersRow } from '../../src/components/TrackersRow';
import { MealCard } from '../../src/components/MealCard';
import { WorkoutModal } from '../../src/components/WorkoutModal';
import { useDashboard, useServerHealth } from '../../src/api/queries';
import { localDateKey, addDays, isToday, formatHeaderDate } from '../../src/lib/dates';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';

export default function HomeScreen() {
  // `at` changes on every Ledger tap, so tapping the same day again still jumps to it
  const { date: paramDate, at: paramAt } = useLocalSearchParams<{ date?: string; at?: string }>();
  const [selectedDate, setSelectedDate] = useState<string>(paramDate || localDateKey());
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false);

  useEffect(() => {
    if (paramDate) {
      setSelectedDate(paramDate);
    }
  }, [paramDate, paramAt]);

  const { data, isLoading, isRefetching, refetch } = useDashboard(selectedDate);
  const { data: health } = useServerHealth();

  const aiNotice =
    health?.aiStatus === 'error'
      ? 'AI isn’t working, so meal photos will fail. Check the AI key on the server.'
      : health?.aiMode === 'mock'
      ? 'Demo mode: AI isn’t connected, so photo results are samples.'
      : null;

  const summary = data?.summary;
  const streak = data?.streak ?? 0;
  const meals = data?.meals ?? [];

  const canStepForward = !isToday(selectedDate);
  const stepBack = () => setSelectedDate((curr) => addDays(curr, -1));
  const stepForward = () => {
    if (canStepForward) {
      setSelectedDate((curr) => addDays(curr, 1));
    }
  };

  const dateLabel = formatHeaderDate(selectedDate);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.wordmark}>Hisaab</Text>
          {streak > 0 && (
            <Text style={styles.streakText}>{streak}-day streak</Text>
          )}
        </View>

        {/* Date Stepper: ‹ Today › */}
        <View style={styles.dateControl}>
          <TouchableOpacity
            onPress={stepBack}
            hitSlop={8}
            style={styles.dateArrow}
            accessibilityRole="button"
            accessibilityLabel="Previous day"
          >
            <ChevronLeft size={20} color={colors.text} strokeWidth={2.4} />
          </TouchableOpacity>
          <Text style={styles.dateLabel}>{dateLabel}</Text>
          <TouchableOpacity
            onPress={stepForward}
            disabled={!canStepForward}
            hitSlop={8}
            style={[styles.dateArrow, !canStepForward && styles.dateArrowDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Next day"
          >
            <ChevronRight
              size={20}
              color={canStepForward ? colors.text : colors.textMute}
              strokeWidth={2.4}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Amber notice strip */}
      {aiNotice && (
        <View style={styles.noticeStrip} accessibilityRole="alert">
          <Text style={styles.noticeText}>{aiNotice}</Text>
        </View>
      )}

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
            <ActivityIndicator color={colors.textDim} size="large" />
          </View>
        ) : summary ? (
          <>
            {/* Balance block (no card border) */}
            <HisaabCard summary={summary} />

            {/* Three macro rings */}
            <MacroRingsRow macros={summary.macros} />

            {/* Two compact tiles: Water & Exercise */}
            <TrackersRow
              summary={summary}
              onOpenWorkout={() => setWorkoutModalVisible(true)}
            />

            {/* Today's meals grouped list */}
            <View style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>Today’s meals</Text>

              {meals.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyTitle}>Nothing logged yet today</Text>
                  <TouchableOpacity
                    style={styles.emptyBtn}
                    onPress={() => router.push('/capture' as any)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.emptyBtnText}>Log a Meal</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.mealsGroup}>
                  {meals.map((meal, idx) => (
                    <View key={meal.id} style={styles.mealRowWrap}>
                      <MealCard
                        meal={meal}
                        onDescribeInstead={() => router.push('/capture' as any)}
                      />
                      {idx < meals.length - 1 && <View style={styles.separator} />}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      {/* Workout Sheet Modal */}
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    gap: 2,
  },
  wordmark: {
    fontFamily: font.bold,
    fontSize: 32,
    letterSpacing: -0.8,
    color: colors.text,
  },
  streakText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textDim,
    letterSpacing: -0.1,
  },
  dateControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 4,
  },
  dateArrow: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  dateLabel: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.text,
    letterSpacing: -0.2,
    paddingHorizontal: 4,
  },
  noticeStrip: {
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
  },
  noticeText: {
    fontFamily: font.medium,
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 100,
    gap: 20,
  },
  centerLoading: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsSection: {
    gap: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontFamily: font.semibold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.4,
  },
  mealsGroup: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  mealRowWrap: {
    position: 'relative',
  },
  separator: {
    position: 'absolute',
    left: 84, // align with text past 56pt thumbnail + padding
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingVertical: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  emptyTitle: {
    fontFamily: font.medium,
    fontSize: 17,
    color: colors.textDim,
    letterSpacing: -0.2,
  },
  emptyBtn: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: '#000000',
    letterSpacing: -0.2,
  },
});

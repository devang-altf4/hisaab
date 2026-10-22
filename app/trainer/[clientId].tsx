import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, radii } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { useTrainerClientDashboard } from '../../src/api/queries';
import { localDateKey, daysAgoKey, formatHeaderDate } from '../../src/lib/dates';
import { HisaabCard } from '../../src/components/HisaabCard';
import { MacroRingsRow } from '../../src/components/MacroRing';
import { MealCard } from '../../src/components/MealCard';
import { ChevronLeft } from 'lucide-react-native';

export default function TrainerClientDashboardScreen() {
  const { clientId } = useLocalSearchParams<{ clientId: string }>();
  const [isYesterday, setIsYesterday] = useState(false);

  const selectedDate = useMemo(() => {
    if (!isYesterday) return undefined;
    return daysAgoKey(1);
  }, [isYesterday]);

  const { data, isLoading, isRefetching, refetch } = useTrainerClientDashboard(clientId!, selectedDate);

  const client = data?.client;
  const dashboard = data?.dashboard;
  const summary = dashboard?.summary;
  const meals = dashboard?.meals || [];
  // No "Yesterday" for a client who joined today: that day didn't exist for them.
  const hasYesterday = !client?.joinedOn || client.joinedOn <= daysAgoKey(1);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={28} color={colors.text} strokeWidth={2.4} />
        </TouchableOpacity>

        <View style={styles.titleWrap}>
          <Text style={styles.clientTitle}>{client?.name || 'Client'}’s day</Text>
          <Text style={styles.viewOnlyLabel}>View only</Text>
        </View>

        {/* Today / Yesterday Toggle */}
        {hasYesterday && (
          <View style={styles.segmented}>
            <TouchableOpacity
              style={[styles.segmentBtn, !isYesterday && styles.segmentBtnOn]}
              onPress={() => setIsYesterday(false)}
            >
              <Text style={[styles.segmentText, !isYesterday && styles.segmentTextOn]}>Today</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.segmentBtn, isYesterday && styles.segmentBtnOn]}
              onPress={() => setIsYesterday(true)}
            >
              <Text style={[styles.segmentText, isYesterday && styles.segmentTextOn]}>Yesterday</Text>
            </TouchableOpacity>
          </View>
        )}
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
            <ActivityIndicator color={colors.textDim} size="large" />
          </View>
        ) : summary ? (
          <>
            {/* Balance block */}
            <HisaabCard summary={summary} />

            {/* Macro rings */}
            <MacroRingsRow macros={summary.macros} />

            {/* Meal list */}
            <View style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>Logged meals</Text>
              {meals.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Nothing logged yet today</Text>
                </View>
              ) : (
                <View style={styles.mealsGroup}>
                  {meals.map((meal, idx) => (
                    <View key={meal.id} style={styles.mealRowWrap}>
                      <MealCard meal={meal} goal={client?.goal} readOnly />
                      {idx < meals.length - 1 && <View style={styles.separator} />}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
  },
  clientTitle: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.3,
  },
  viewOnlyLabel: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.textDim,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  segmentBtnOn: {
    backgroundColor: colors.control,
  },
  segmentText: {
    fontFamily: font.medium,
    fontSize: 12,
    color: colors.textDim,
  },
  segmentTextOn: {
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 60,
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
    left: 84,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  emptyContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDim,
  },
});

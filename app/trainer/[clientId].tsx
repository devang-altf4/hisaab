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
import { colors, radii, spacing } from '../../src/theme/tokens';
import { useTrainerClientDashboard } from '../../src/api/queries';
import { daysAgoKey } from '../../src/lib/dates';
import { HisaabCard } from '../../src/components/HisaabCard';
import { MacroRingsRow } from '../../src/components/MacroRing';
import { MealCard } from '../../src/components/MealCard';
import { ArrowLeft, ShieldCheck, Flame } from 'lucide-react-native';

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

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.titleContainer}>
          <Text style={styles.clientTitle}>{client?.name || 'Client'}'s Day</Text>
          <View style={styles.readOnlyBadge}>
            <ShieldCheck size={11} color={colors.accent} />
            <Text style={styles.readOnlyText}>Read-Only Trainer View</Text>
          </View>
        </View>

        {/* Date toggle */}
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
            <Text style={[styles.segmentText, isYesterday && styles.segmentTextActive]}>Y'day</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => { void refetch(); }} tintColor={colors.accent} />
        }
      >
        {isLoading && !data ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : summary ? (
          <>
            <HisaabCard summary={summary} />
            <MacroRingsRow macros={summary.macros} />

            <View style={styles.mealsSection}>
              <Text style={styles.sectionTitle}>Client's Logged Meals ({meals.length})</Text>
              {meals.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No meals logged for this day.</Text>
                </View>
              ) : (
                meals.map((meal) => (
                  <MealCard key={meal.id} meal={meal} readOnly />
                ))
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
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  titleContainer: {
    flex: 1,
  },
  clientTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  readOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  readOnlyText: {
    fontSize: 10,
    fontWeight: '700',
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.pill,
  },
  segmentBtnActive: {
    backgroundColor: colors.cardAlt,
  },
  segmentText: {
    fontSize: 11,
    color: colors.textMute,
    fontWeight: '600',
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
  centerLoading: {
    height: 300,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealsSection: {
    marginTop: spacing.sm,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textDim,
  },
});

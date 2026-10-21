import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useLedger } from '../../src/api/queries';
import { PnlBadge } from '../../src/components/PnlBadge';
import { router } from 'expo-router';
import { daysAgoKey } from '../../src/lib/dates';
import { Calendar, ChevronRight, TrendingUp, TrendingDown, Award } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HisaabScreen() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  const { fromDate, toDate } = useMemo(
    () => ({ fromDate: daysAgoKey(rangeDays - 1), toDate: daysAgoKey(0) }),
    [rangeDays],
  );

  const { data: ledgerData, isLoading, refetch } = useLedger(fromDate, toDate);

  const totals = ledgerData?.totals;
  const days = ledgerData?.days || [];

  // Bar chart calculations
  const chartWidth = SCREEN_WIDTH - spacing.xl * 2 - spacing.lg * 2;
  const chartHeight = 160;
  const zeroY = chartHeight / 2;

  const maxAmount = useMemo(() => {
    if (!days.length) return 500;
    const max = Math.max(...days.map((d) => Math.abs(d.pnl.amount)), 200);
    return max;
  }, [days]);

  const barWidth = Math.max(4, Math.floor((chartWidth / (days.length || 7)) - 4));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Ledger</Text>
          <Text style={styles.headerSub}>Your profit and loss over time</Text>
        </View>

        {/* Range Chips */}
        <View style={styles.rangeChips}>
          <TouchableOpacity
            style={[styles.rangeChip, rangeDays === 7 && styles.rangeChipActive]}
            onPress={() => setRangeDays(7)}
          >
            <Text style={[styles.rangeChipText, rangeDays === 7 && styles.rangeChipTextActive]}>
              7 Days
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.rangeChip, rangeDays === 30 && styles.rangeChipActive]}
            onPress={() => setRangeDays(30)}
          >
            <Text style={[styles.rangeChipText, rangeDays === 30 && styles.rangeChipTextActive]}>
              30 Days
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {isLoading && !ledgerData ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.accent} size="large" />
          </View>
        ) : totals ? (
          <>
            {/* Top P&L Card */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <Text style={styles.summaryLabel}>
                  {rangeDays === 7 ? 'THIS WEEK' : 'LAST 30 DAYS'}
                </Text>
                <PnlBadge pnl={totals.pnl} size="md" />
              </View>

              <Text style={styles.kgHighlight}>
                {totals.pnl.status === 'PROFIT'
                  ? `About ${Math.abs(totals.pnl.kgEquivalent)} kg of fat in profit`
                  : totals.pnl.status === 'LOSS'
                  ? `About ${Math.abs(totals.pnl.kgEquivalent)} kg of fat in loss`
                  : 'Breaking even so far'}
              </Text>

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: colors.profit }]}>
                    {totals.profitDays}
                  </Text>
                  <Text style={styles.statLabel}>Profit Days</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={[styles.statVal, { color: colors.loss }]}>
                    {totals.lossDays}
                  </Text>
                  <Text style={styles.statLabel}>Loss Days</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statVal}>{totals.loggedDays}</Text>
                  <Text style={styles.statLabel}>Logged</Text>
                </View>
              </View>
            </View>

            {/* SVG Bar Chart */}
            <View style={styles.chartCard}>
              <View style={styles.chartHeader}>
                <Text style={styles.chartTitle}>P&L Trajectory</Text>
                <View style={styles.chartLegend}>
                  <View style={[styles.legendDot, { backgroundColor: colors.profit }]} />
                  <Text style={styles.legendText}>Profit</Text>
                  <View style={[styles.legendDot, { backgroundColor: colors.loss, marginLeft: 8 }]} />
                  <Text style={styles.legendText}>Loss</Text>
                </View>
              </View>

              <View style={styles.svgWrapper}>
                <Svg width={chartWidth} height={chartHeight}>
                  {/* Zero line */}
                  <Line
                    x1="0"
                    y1={zeroY}
                    x2={chartWidth}
                    y2={zeroY}
                    stroke={colors.border}
                    strokeWidth="1.5"
                    strokeDasharray="4 4"
                  />

                  {/* Bars */}
                  {days.map((d, idx) => {
                    const x = idx * (barWidth + 4);
                    const isLogged = d.logged;
                    const amount = d.pnl.amount;

                    if (!isLogged) {
                      // Grey stub for empty days
                      return (
                        <Rect
                          key={d.date}
                          x={x}
                          y={zeroY - 2}
                          width={barWidth}
                          height={4}
                          fill={colors.cardAlt}
                          rx={2}
                        />
                      );
                    }

                    const barHeight = Math.max(
                      4,
                      Math.min(zeroY - 10, (Math.abs(amount) / maxAmount) * (zeroY - 10))
                    );

                    const isProfit = amount >= 0;
                    const y = isProfit ? zeroY - barHeight : zeroY;
                    const fillColor = isProfit ? colors.profit : colors.loss;

                    return (
                      <Rect
                        key={d.date}
                        x={x}
                        y={y}
                        width={barWidth}
                        height={barHeight}
                        fill={fillColor}
                        rx={2}
                      />
                    );
                  })}
                </Svg>
              </View>
            </View>

            {/* Daily ledger list */}
            <View style={styles.khataSection}>
              <Text style={styles.khataSectionTitle}>Day by day</Text>
              {days.slice().reverse().map((day) => {
                const dateObj = new Date(day.date + 'T00:00:00');
                const dateDisplay = dateObj.toLocaleDateString('en-IN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                });

                return (
                  <TouchableOpacity
                    key={day.date}
                    style={styles.khataRow}
                    activeOpacity={0.7}
                    onPress={() => {
                      // Navigate to dashboard
                      router.replace('/(tabs)');
                    }}
                  >
                    <View style={styles.khataLeft}>
                      <Text style={styles.khataDate}>{dateDisplay}</Text>
                      <View style={styles.khataDetails}>
                        <Text style={styles.khataSub}>
                          Eaten: <Text style={styles.khataHighlight}>{day.eaten}</Text> kcal
                        </Text>
                        {day.burned > 0 && (
                          <Text style={[styles.khataSub, { color: colors.profit }]}>
                            · Burned: +{day.burned}
                          </Text>
                        )}
                      </View>
                    </View>

                    <View style={styles.khataRight}>
                      {day.logged ? (
                        <PnlBadge pnl={day.pnl} size="sm" />
                      ) : (
                        <Text style={styles.khataSub}>Nothing logged</Text>
                      )}
                      <ChevronRight size={16} color={colors.textMute} />
                    </View>
                  </TouchableOpacity>
                );
              })}
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  rangeChips: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: radii.pill,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.pill,
  },
  rangeChipActive: {
    backgroundColor: colors.cardAlt,
  },
  rangeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMute,
  },
  rangeChipTextActive: {
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
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMute,
    letterSpacing: 1,
  },
  kgHighlight: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  statBox: {
    alignItems: 'center',
  },
  statVal: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMute,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  chartLegend: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: colors.textMute,
  },
  svgWrapper: {
    alignItems: 'center',
  },
  khataSection: {
    marginTop: spacing.sm,
  },
  khataSectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.md,
  },
  khataRow: {
    backgroundColor: colors.card,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  khataLeft: {
    gap: 3,
  },
  khataDate: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  khataDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  khataSub: {
    fontSize: 12,
    color: colors.textDim,
  },
  khataHighlight: {
    color: colors.text,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  khataRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});


import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import { colors, radii } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { useLedger } from '../../src/api/queries';
import { router } from 'expo-router';
import { daysAgoKey, parseLocalDate, formatHeaderDate } from '../../src/lib/dates';
import { ChevronRight } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function HisaabScreen() {
  const [rangeDays, setRangeDays] = useState<7 | 30>(7);

  const { fromDate, toDate } = useMemo(
    () => ({ fromDate: daysAgoKey(rangeDays - 1), toDate: daysAgoKey(0) }),
    [rangeDays],
  );

  const { data: ledgerData, isLoading, isRefetching, refetch } = useLedger(fromDate, toDate);

  const totals = ledgerData?.totals;
  const days = ledgerData?.days || [];

  // Chart dimensions
  const chartWidth = SCREEN_WIDTH - 48 - 32; // side margins 24*2 + card padding 16*2
  const chartHeight = 160;
  const zeroY = chartHeight / 2;

  const maxAmount = useMemo(() => {
    if (!days.length) return 500;
    const max = Math.max(...days.map((d) => Math.abs(d.pnl.amount)), 200);
    return max;
  }, [days]);

  const barWidth = Math.max(4, Math.floor(chartWidth / (days.length || 7) - (rangeDays === 7 ? 16 : 4)));
  const stepX = chartWidth / (days.length || 7);

  const isProfit = totals?.pnl.status === 'PROFIT';
  const isLoss = totals?.pnl.status === 'LOSS';
  const pnlSign = isProfit ? '+' : isLoss ? '−' : '';
  const pnlColor = isProfit ? colors.profit : isLoss ? colors.loss : colors.accent;

  const summaryLabel = rangeDays === 7 ? 'This week' : 'Last 30 days';
  const pnlTitle = totals
    ? `${pnlSign}${Math.abs(totals.pnl.amount).toLocaleString()} kcal ${isProfit ? 'in profit' : isLoss ? 'in loss' : 'break-even'}`
    : '';

  const fatKg = totals?.pnl.kgEquivalent ? Math.abs(totals.pnl.kgEquivalent).toFixed(2) : '0';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.largeTitle}>Ledger</Text>

        {/* Segmented Control 7 days / 30 days */}
        <View style={styles.segmented}>
          <TouchableOpacity
            style={[styles.segmentBtn, rangeDays === 7 && styles.segmentBtnOn]}
            onPress={() => setRangeDays(7)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, rangeDays === 7 && styles.segmentTextOn]}>7 days</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentBtn, rangeDays === 30 && styles.segmentBtnOn]}
            onPress={() => setRangeDays(30)}
            activeOpacity={0.8}
          >
            <Text style={[styles.segmentText, rangeDays === 30 && styles.segmentTextOn]}>30 days</Text>
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
        {isLoading && !ledgerData ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator color={colors.textDim} size="large" />
          </View>
        ) : totals ? (
          <>
            {/* Summary Group */}
            <View style={styles.group}>
              <View style={styles.summaryTop}>
                <Text style={styles.summaryLabel}>{summaryLabel}</Text>
                <Text style={[styles.summaryPnl, { color: pnlColor }]}>{pnlTitle}</Text>
                <Text style={styles.summaryFat}>About {fatKg} kg of fat</Text>
              </View>

              <View style={styles.separator} />

              <View style={styles.statsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{totals.profitDays}</Text>
                  <Text style={styles.statLabel}>Profit days</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{totals.lossDays}</Text>
                  <Text style={styles.statLabel}>Loss days</Text>
                </View>
                <View style={styles.statBox}>
                  <Text style={styles.statNumber}>{totals.loggedDays}</Text>
                  <Text style={styles.statLabel}>Logged</Text>
                </View>
              </View>
            </View>

            {/* Zero-line Bar Chart */}
            <View style={styles.chartCard}>
              <Svg width={chartWidth} height={chartHeight + 20}>
                {/* Zero line */}
                <Line
                  x1="0"
                  y1={zeroY}
                  x2={chartWidth}
                  y2={zeroY}
                  stroke={colors.border}
                  strokeWidth="1"
                  strokeDasharray="4,4"
                />

                {/* Bars */}
                {days.map((day, i) => {
                  const x = i * stepX + (stepX - barWidth) / 2;
                  const amt = day.pnl.amount;
                  const dayObj = parseLocalDate(day.date);
                  const initial = ['S', 'M', 'T', 'W', 'T', 'F', 'S'][dayObj.getDay()];

                  if (!day.logged) {
                    return (
                      <React.Fragment key={day.date}>
                        <Rect
                          x={x}
                          y={zeroY - 2}
                          width={barWidth}
                          height={4}
                          fill={colors.border}
                          rx={2}
                        />
                        {rangeDays === 7 && (
                          <SvgText
                            x={x + barWidth / 2}
                            y={chartHeight + 14}
                            fontSize="11"
                            fill={colors.textMute}
                            textAnchor="middle"
                            fontFamily="Inter_400Regular"
                          >
                            {initial}
                          </SvgText>
                        )}
                      </React.Fragment>
                    );
                  }

                  const barHeight = Math.min((Math.abs(amt) / maxAmount) * (zeroY - 10), zeroY - 8);
                  const isDayProfit = day.pnl.status === 'PROFIT';
                  const y = isDayProfit ? zeroY - barHeight : zeroY;

                  return (
                    <React.Fragment key={day.date}>
                      <Rect
                        x={x}
                        y={y}
                        width={barWidth}
                        height={Math.max(barHeight, 4)}
                        fill={isDayProfit ? colors.profit : colors.loss}
                        rx={3}
                      />
                      {rangeDays === 7 && (
                        <SvgText
                          x={x + barWidth / 2}
                          y={chartHeight + 14}
                          fontSize="11"
                          fill={colors.textDim}
                          textAnchor="middle"
                          fontFamily="Inter_500Medium"
                        >
                          {initial}
                        </SvgText>
                      )}
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>

            {/* Day by day grouped list */}
            <View style={styles.daysSection}>
              <Text style={styles.sectionTitle}>Day by day</Text>
              <View style={styles.group}>
                {days.slice().reverse().map((day, idx) => {
                  const dayTitle = formatHeaderDate(day.date);
                  const isDayProfit = day.pnl.status === 'PROFIT';
                  const isDayLoss = day.pnl.status === 'LOSS';
                  const tagSign = isDayProfit ? '+' : isDayLoss ? '−' : '';
                  const tagText = day.logged
                    ? `${tagSign}${Math.abs(day.pnl.amount)}`
                    : 'Nothing logged';
                  const tagColor = !day.logged
                    ? colors.textMute
                    : isDayProfit
                    ? colors.profit
                    : colors.loss;
                  const tagBg = !day.logged
                    ? 'transparent'
                    : isDayProfit
                    ? 'rgba(16, 185, 129, 0.14)'
                    : 'rgba(255, 69, 58, 0.14)';

                  return (
                    <View key={day.date} style={styles.dayRowWrap}>
                      <TouchableOpacity
                        style={styles.dayRow}
                        activeOpacity={0.7}
                        onPress={() => {
                          router.push({ pathname: '/(tabs)', params: { date: day.date, at: String(Date.now()) } } as any);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.dayDate}>{dayTitle}</Text>
                          {day.logged ? (
                            <Text style={styles.dayDetail}>
                              Eaten {day.eaten.toLocaleString()}, Burned {day.burned.toLocaleString()}
                            </Text>
                          ) : null}
                        </View>

                        <View style={[styles.dayTag, { backgroundColor: tagBg }]}>
                          <Text style={[styles.dayTagText, { color: tagColor }]}>{tagText}</Text>
                        </View>
                        <ChevronRight size={18} color={colors.border} />
                      </TouchableOpacity>
                      {idx < days.length - 1 && <View style={styles.separator} />}
                    </View>
                  );
                })}
              </View>
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
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  largeTitle: {
    fontFamily: font.bold,
    fontSize: 34,
    letterSpacing: -0.8,
    color: colors.text,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 3,
  },
  segmentBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  segmentBtnOn: {
    backgroundColor: colors.control,
  },
  segmentText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.textDim,
  },
  segmentTextOn: {
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 20,
  },
  centerLoading: {
    height: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  summaryTop: {
    padding: 20,
    gap: 4,
  },
  summaryLabel: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDim,
    letterSpacing: -0.2,
  },
  summaryPnl: {
    fontFamily: font.bold,
    fontSize: 28,
    letterSpacing: -0.6,
    marginVertical: 2,
    fontVariant: ['tabular-nums'],
  },
  summaryFat: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDim,
    letterSpacing: -0.2,
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 14,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statNumber: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.textDim,
  },
  chartCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    alignItems: 'center',
  },
  daysSection: {
    gap: 10,
  },
  sectionTitle: {
    fontFamily: font.semibold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.4,
  },
  dayRowWrap: {
    position: 'relative',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  dayDate: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  dayDetail: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
    marginTop: 2,
    letterSpacing: -0.1,
  },
  dayTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayTagText: {
    fontFamily: font.semibold,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});

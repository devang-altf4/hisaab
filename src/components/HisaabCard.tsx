import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/tokens';
import { font } from '../theme/fonts';
import type { DaySummary } from '../api/hisaabApi';

interface HisaabCardProps {
  summary: DaySummary;
}

export const HisaabCard: React.FC<HisaabCardProps> = ({ summary }) => {
  const isProfit = summary.pnl.status === 'PROFIT';
  const isLoss = summary.pnl.status === 'LOSS';

  const pillText = isProfit
    ? `In profit, ${Math.abs(summary.pnl.amount).toLocaleString()} kcal`
    : isLoss
    ? `In loss, ${Math.abs(summary.pnl.amount).toLocaleString()} kcal`
    : summary.pnl.label;

  const pillColor = isProfit ? colors.profit : isLoss ? colors.loss : colors.accent;
  const pillBg = isProfit
    ? 'rgba(16, 185, 129, 0.15)'
    : isLoss
    ? 'rgba(255, 69, 58, 0.15)'
    : 'rgba(245, 158, 11, 0.15)';

  return (
    <View style={styles.container}>
      {/* Huge balance number + label */}
      <View style={styles.numberRow}>
        <Text style={styles.balanceNumber}>
          {summary.caloriesLeft.toLocaleString()}
        </Text>
      </View>
      <Text style={styles.balanceLabel}>calories left</Text>

      {/* Pill */}
      <View style={[styles.pill, { backgroundColor: pillBg }]}>
        <Text style={[styles.pillText, { color: pillColor }]}>{pillText}</Text>
      </View>

      {/* Quiet row: Budget · Eaten · Burned */}
      <View style={styles.sublineRow}>
        <Text style={styles.sublineText}>
          Budget {summary.budget.toLocaleString()} · Eaten {summary.eaten.toLocaleString()} · Burned {summary.burned.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  balanceNumber: {
    fontFamily: font.bold,
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1.5,
    fontVariant: ['tabular-nums'],
    color: colors.text,
  },
  balanceLabel: {
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.textDim,
    letterSpacing: -0.2,
    marginTop: 2,
    marginBottom: 10,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  pillText: {
    fontFamily: font.semibold,
    fontSize: 14,
    letterSpacing: -0.2,
  },
  sublineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sublineText: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
    letterSpacing: -0.1,
  },
});

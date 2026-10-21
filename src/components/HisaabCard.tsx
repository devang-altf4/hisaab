import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii, spacing, typography } from '../theme/tokens';
import { PnlBadge } from './PnlBadge';
import type { DaySummary } from '../api/hisaabApi';

interface HisaabCardProps {
  summary: DaySummary;
}

export const HisaabCard: React.FC<HisaabCardProps> = ({ summary }) => {
  const isProfit = summary.pnl.status === 'PROFIT';
  const isLoss = summary.pnl.status === 'LOSS';
  const glowColor = isProfit
    ? colors.surfaceGlow
    : isLoss
    ? colors.surfaceLossGlow
    : 'rgba(245, 158, 11, 0.08)';

  return (
    <View style={[styles.card, { borderColor: isProfit ? 'rgba(16, 185, 129, 0.3)' : isLoss ? 'rgba(239, 68, 68, 0.3)' : colors.border }]}>
      <View style={[styles.glowBackground, { backgroundColor: glowColor }]} />

      <View style={styles.headerRow}>
        <Text style={styles.cardHeaderTitle}>DAILY BALANCE</Text>
        <PnlBadge pnl={summary.pnl} size="md" />
      </View>

      <View style={styles.numberRow}>
        <Text style={typography.balanceNumber}>
          {summary.caloriesLeft.toLocaleString()}
        </Text>
        <Text style={styles.unitText}>kcal</Text>
      </View>

      <Text style={styles.balanceLabel}>Calories left (Balance)</Text>

      <View style={styles.divider} />

      <View style={styles.sublineRow}>
        <View style={styles.subItem}>
          <Text style={styles.subLabel}>Budget</Text>
          <Text style={styles.subVal}>{summary.budget.toLocaleString()}</Text>
        </View>
        <Text style={styles.dotSeparator}>·</Text>
        <View style={styles.subItem}>
          <Text style={styles.subLabel}>Eaten</Text>
          <Text style={styles.subVal}>{summary.eaten.toLocaleString()}</Text>
        </View>
        <Text style={styles.dotSeparator}>·</Text>
        <View style={styles.subItem}>
          <Text style={styles.subLabel}>Burned</Text>
          <Text style={[styles.subVal, { color: summary.burned > 0 ? colors.profit : colors.text }]}>
            +{summary.burned.toLocaleString()}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    padding: spacing.xl,
    overflow: 'hidden',
    position: 'relative',
  },
  glowBackground: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 1,
  },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  unitText: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.textDim,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textDim,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  sublineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  subLabel: {
    fontSize: 13,
    color: colors.textMute,
  },
  subVal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  dotSeparator: {
    color: colors.textMute,
    fontSize: 14,
  },
});


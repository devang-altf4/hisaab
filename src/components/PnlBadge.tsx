import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
import type { Pnl, PnlStatus } from '../api/hisaabApi';

interface PnlBadgeProps {
  pnl: Pnl | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}

export const PnlBadge: React.FC<PnlBadgeProps> = ({ pnl, size = 'md' }) => {
  if (!pnl) return null;

  const status: PnlStatus = pnl.status;
  const isProfit = status === 'PROFIT';
  const isLoss = status === 'LOSS';

  const badgeColor = isProfit ? colors.profit : isLoss ? colors.loss : colors.accent;
  const bg = isProfit ? 'rgba(16, 185, 129, 0.14)' : isLoss ? 'rgba(255, 69, 58, 0.14)' : 'rgba(245, 158, 11, 0.14)';

  const fontSize = size === 'sm' ? 12 : size === 'lg' ? 15 : 13;
  const paddingVertical = size === 'sm' ? 3 : size === 'lg' ? 6 : 4;
  const paddingHorizontal = size === 'sm' ? 8 : size === 'lg' ? 12 : 10;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bg,
          paddingVertical,
          paddingHorizontal,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: badgeColor }]} />
      <Text style={[styles.text, { color: badgeColor, fontSize }]}>{pnl.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    fontFamily: font.semibold,
    letterSpacing: -0.1,
  },
});

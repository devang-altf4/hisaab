import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, radii, spacing } from '../theme/tokens';
import type { MacroLine } from '../api/hisaabApi';

interface SingleRingProps {
  label: string;
  macro: MacroLine;
  color: string;
  size?: number;
  strokeWidth?: number;
}

export const SingleMacroRing: React.FC<SingleRingProps> = ({
  label,
  macro,
  color,
  size = 88,
  strokeWidth = 7,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progressClamped = Math.min(Math.max(macro.progress, 0), 1);
  const strokeDashoffset = circumference - progressClamped * circumference;
  const isOver = macro.progress > 1;
  const ringColor = isOver ? colors.loss : color;

  return (
    <View style={styles.ringWrapper}>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
            {/* Background track */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#22222A"
              strokeWidth={strokeWidth}
              fill="transparent"
            />
            {/* Progress arc */}
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={ringColor}
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              fill="transparent"
            />
          </G>
        </Svg>
        <View style={styles.centerTextContainer}>
          <Text style={styles.leftAmount}>
            {macro.left < 0 ? `+${Math.abs(macro.left)}` : `${macro.left}`}g
          </Text>
          <Text style={styles.leftSub}>{macro.left < 0 ? 'over' : 'left'}</Text>
        </View>
      </View>
      <Text style={[styles.ringLabel, { color }]}>{label}</Text>
      <Text style={styles.targetSub}>
        {macro.eaten}/{macro.target}g
      </Text>
    </View>
  );
};

interface MacroRingsRowProps {
  macros: {
    protein: MacroLine;
    carbs: MacroLine;
    fat: MacroLine;
  };
}

export const MacroRingsRow: React.FC<MacroRingsRowProps> = ({ macros }) => {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionHeader}>Macros Breakdown</Text>
      <View style={styles.row}>
        <SingleMacroRing label="Protein" macro={macros.protein} color={colors.protein} />
        <SingleMacroRing label="Carbs" macro={macros.carbs} color={colors.carbs} />
        <SingleMacroRing label="Fat" macro={macros.fat} color={colors.fat} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderColor: colors.border,
    borderWidth: 1,
    padding: spacing.lg,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMute,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ringWrapper: {
    alignItems: 'center',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  leftSub: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textDim,
  },
  ringLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  targetSub: {
    fontSize: 11,
    fontWeight: '400',
    color: colors.textMute,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});


import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
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
  size = 82,
  strokeWidth = 6.5,
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
              stroke="#2C2C2E"
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
            {macro.left < 0 ? `+${Math.abs(macro.left)}` : `${macro.left}`}
          </Text>
          <Text style={styles.leftUnit}>{macro.left < 0 ? 'over' : 'left'}</Text>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
      <Text style={styles.targetSub}>
        {macro.eaten} of {macro.target} g
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
    <View style={styles.groupContainer}>
      <View style={styles.row}>
        <SingleMacroRing label="Protein" macro={macros.protein} color={colors.protein} />
        <SingleMacroRing label="Carbs" macro={macros.carbs} color={colors.carbs} />
        <SingleMacroRing label="Fat" macro={macros.fat} color={colors.fat} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  groupContainer: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ringWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftAmount: {
    fontFamily: font.bold,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  leftUnit: {
    fontFamily: font.regular,
    fontSize: 11,
    color: colors.textDim,
    marginTop: -2,
  },
  ringLabel: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: colors.text,
    marginTop: 8,
    letterSpacing: -0.2,
  },
  targetSub: {
    fontFamily: font.regular,
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
});

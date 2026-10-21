import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, ChevronLeft, Minus, Plus } from 'lucide-react-native';
import { font } from '../theme/fonts';
import { colors } from '../theme/tokens';

/**
 * Onboarding kit — Apple setup-assistant restraint: true black, one decision per screen,
 * grouped lists with a checkmark, one white pill button at the bottom. No emoji, no badges.
 */
export const ob = {
  bg: '#000000',
  group: '#1C1C1E',
  control: '#2C2C2E',
  selected: '#636366',
  separator: '#38383A',
  label: '#FFFFFF',
  secondary: '#8E8E93',
  tertiary: '#48484A',
  profit: colors.profit,
  loss: '#FF453A',
};

export function Title({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={s.titleBlock}>
      <Text style={s.title} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.primary, pressed && { opacity: 0.8 }, disabled && { opacity: 0.35 }]}
    >
      {loading ? <ActivityIndicator color="#000" /> : <Text style={s.primaryText}>{label}</Text>}
    </Pressable>
  );
}

export function TextButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [s.textBtn, pressed && { opacity: 0.5 }]}
    >
      <Text style={s.textBtnText}>{label}</Text>
    </Pressable>
  );
}

/** Back chevron + segmented progress for the question steps. */
export function StepHeader({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  return (
    <View style={s.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={onBack}
        hitSlop={12}
        style={({ pressed }) => [s.back, pressed && { opacity: 0.4 }]}
      >
        <ChevronLeft size={30} color={ob.label} strokeWidth={2.2} />
      </Pressable>
      <View
        style={s.progress}
        accessibilityRole="progressbar"
        accessibilityLabel={`Step ${step} of ${total}`}
        accessibilityValue={{ min: 1, max: total, now: step }}
      >
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[s.progressSeg, i < step && s.progressSegOn]} />
        ))}
      </View>
      <View style={s.back} />
    </View>
  );
}

export interface Choice<T extends string> {
  id: T;
  title: string;
  detail: string;
}

/** Grouped inset list; the selected row gets a checkmark (no borders, no tinted cards). */
export function ChoiceList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Choice<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.group} accessibilityRole="radiogroup">
      {options.map((o, i) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${o.title}. ${o.detail}`}
            onPress={() => onChange(o.id)}
            style={({ pressed }) => [s.row, pressed && { backgroundColor: ob.control }]}
          >
            <View style={s.rowText}>
              <Text style={s.rowTitle}>{o.title}</Text>
              <Text style={s.rowDetail}>{o.detail}</Text>
            </View>
            <View style={s.check}>{on ? <Check size={22} color={ob.label} strokeWidth={2.6} /> : null}</View>
            {i < options.length - 1 ? <View style={s.separator} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={s.segmented} accessibilityRole="radiogroup">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(o.id)}
            style={[s.segment, on && s.segmentOn]}
          >
            <Text style={[s.segmentText, on && s.segmentTextOn]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  return <Text style={s.sectionLabel}>{children}</Text>;
}

/** A grouped row with a big editable number and ± controls. */
export function NumberRow({
  label,
  unit,
  value,
  onChange,
  step = 1,
  min,
  max,
  last,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
  step?: number;
  min: number;
  max: number;
  last?: boolean;
}) {
  const bump = (d: number) => {
    const n = parseFloat(value);
    const next = Math.min(max, Math.max(min, (isNaN(n) ? min : n) + d));
    onChange(String(Math.round(next * 10) / 10));
  };
  return (
    <View style={[s.row, s.numberRow]}>
      <View style={s.rowText}>
        <Text style={s.rowTitle}>{label}</Text>
      </View>
      <View style={s.stepper}>
        <RoundIcon label={`Decrease ${label}`} onPress={() => bump(-step)}>
          <Minus size={18} color={ob.label} strokeWidth={2.4} />
        </RoundIcon>
        <View style={s.numberBox}>
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^0-9.]/g, ''))}
            accessibilityLabel={`${label} in ${unit}`}
            keyboardType="numeric"
            maxLength={5}
            selectTextOnFocus
            style={s.number}
            selectionColor={ob.label}
          />
          <Text style={s.unit}>{unit}</Text>
        </View>
        <RoundIcon label={`Increase ${label}`} onPress={() => bump(step)}>
          <Plus size={18} color={ob.label} strokeWidth={2.4} />
        </RoundIcon>
      </View>
      {!last ? <View style={s.separator} /> : null}
    </View>
  );
}

function RoundIcon({ children, onPress, label }: { children: React.ReactNode; onPress: () => void; label: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [s.round, pressed && { backgroundColor: ob.selected }]}
    >
      {children}
    </Pressable>
  );
}

export function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <Text style={s.error} accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

const s = StyleSheet.create({
  titleBlock: { marginTop: 20, marginBottom: 32 },
  title: { fontFamily: font.bold, fontSize: 34, lineHeight: 41, letterSpacing: -0.8, color: ob.label },
  subtitle: { fontFamily: font.regular, fontSize: 17, lineHeight: 24, letterSpacing: -0.2, color: ob.secondary, marginTop: 8 },

  primary: {
    height: 56,
    borderRadius: 28,
    backgroundColor: ob.label,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: font.semibold, fontSize: 17, letterSpacing: -0.2, color: '#000000' },
  textBtn: { height: 48, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  textBtnText: { fontFamily: font.medium, fontSize: 17, letterSpacing: -0.2, color: ob.secondary },

  header: { height: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  progress: { flex: 1, flexDirection: 'row', gap: 6, paddingHorizontal: 20 },
  progressSeg: { flex: 1, height: 3, borderRadius: 2, backgroundColor: ob.separator },
  progressSegOn: { backgroundColor: ob.label },

  group: { backgroundColor: ob.group, borderRadius: 14, overflow: 'hidden' },
  row: {
    minHeight: 66,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, letterSpacing: -0.3, color: ob.label },
  rowDetail: { fontFamily: font.regular, fontSize: 15, lineHeight: 20, letterSpacing: -0.1, color: ob.secondary, marginTop: 2 },
  check: { width: 28, alignItems: 'flex-end' },
  separator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ob.separator,
  },

  segmented: { flexDirection: 'row', backgroundColor: ob.group, borderRadius: 12, padding: 3, height: 46 },
  segment: { flex: 1, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  segmentOn: { backgroundColor: ob.selected },
  segmentText: { fontFamily: font.semibold, fontSize: 16, letterSpacing: -0.2, color: ob.secondary },
  segmentTextOn: { color: ob.label },

  sectionLabel: {
    fontFamily: font.regular,
    fontSize: 15,
    letterSpacing: -0.1,
    color: ob.secondary,
    marginBottom: 8,
    marginLeft: 16,
  },

  numberRow: { minHeight: 76 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  // Fixed widths: an unsized TextInput takes its platform default width and shoves the + off-row.
  numberBox: { width: 104, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center' },
  number: {
    width: 66,
    fontFamily: font.bold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: ob.label,
    textAlign: 'right',
    padding: 0,
    includeFontPadding: false,
    fontVariant: ['tabular-nums'],
    outlineWidth: 0, // web: no browser focus ring
  },
  unit: { width: 34, fontFamily: font.medium, fontSize: 15, color: ob.secondary, marginLeft: 4 },
  round: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: ob.control,
    alignItems: 'center',
    justifyContent: 'center',
  },

  error: { fontFamily: font.medium, fontSize: 15, lineHeight: 21, color: ob.loss, marginTop: 16, marginLeft: 16 },
});

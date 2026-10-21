import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '../src/auth/AuthContext';
import { api } from '../src/api/client';
import type { ActivityLevel, Goal, Profile, Sex } from '../src/api/hisaabApi';
import {
  registerPushToken,
  requestNotificationPermission,
  syncNotificationSchedule,
} from '../src/notifications/notificationService';
import { font } from '../src/theme/fonts';
import { colors } from '../src/theme/tokens';
import {
  ChoiceList,
  ErrorLine,
  NumberRow,
  PrimaryButton,
  SectionLabel,
  Segmented,
  StepHeader,
  TextButton,
  Title,
  ob,
  type Choice,
} from '../src/onboarding/kit';

/** 0 welcome · 1–5 questions · 6 budget reveal · 7 reminders */
type Step = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
const QUESTION_COUNT = 5;

const GOALS: Choice<Goal>[] = [
  { id: 'lose', title: 'Lose weight', detail: 'Eat under your budget each day' },
  { id: 'maintain', title: 'Maintain weight', detail: 'Stay close to your budget' },
  { id: 'gain', title: 'Gain weight', detail: 'Eat over your budget to build muscle' },
];

const ACTIVITY: Choice<ActivityLevel>[] = [
  { id: 'sedentary', title: 'Mostly sitting', detail: 'Desk job, little walking' },
  { id: 'light', title: 'Lightly active', detail: 'Walks, 1–2 workouts a week' },
  { id: 'moderate', title: 'Active', detail: '3–5 workouts a week' },
  { id: 'active', title: 'Very active', detail: 'Hard training 6–7 days a week' },
];

const BUDGET_LINE: Record<Goal, string> = {
  lose: 'Eat under this and the day ends in profit.',
  maintain: 'Stay close to this and the day breaks even.',
  gain: 'Eat over this to build muscle. That’s your profit.',
};

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduced).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => sub.remove();
  }, []);
  return reduced;
}

export default function OnboardingScreen() {
  const { user, updateProfile, refreshUser } = useAuth();
  const reducedMotion = useReducedMotion();

  const [step, setStep] = useState<Step>(0);
  const [name, setName] = useState(user?.name && !['Dost', 'Friend'].includes(user.name) ? user.name : '');
  const [goal, setGoal] = useState<Goal>('lose');
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('26');
  const [heightCm, setHeightCm] = useState('170');
  const [weightKg, setWeightKg] = useState('70');
  const [activity, setActivity] = useState<ActivityLevel>('light');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One quiet transition between screens, answering the tap that caused it.
  const fade = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) return;
    fade.setValue(0);
    Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [step, reducedMotion, fade]);

  const go = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const next = async () => {
    setError(null);
    if (step === 1 && !name.trim()) return setError('Enter your name to continue.');
    if (step === 3) {
      const a = parseInt(age, 10);
      if (isNaN(a) || a < 13 || a > 100) return setError('Enter an age between 13 and 100.');
    }
    if (step === 4) {
      const h = parseFloat(heightCm);
      const w = parseFloat(weightKg);
      if (isNaN(h) || h < 100 || h > 250) return setError('Enter a height between 100 and 250 cm.');
      if (isNaN(w) || w < 25 || w > 300) return setError('Enter a weight between 25 and 300 kg.');
    }
    if (step === 5) {
      setBusy(true);
      try {
        const profile: Profile = {
          sex,
          age: parseInt(age, 10),
          heightCm: parseFloat(heightCm),
          weightKg: parseFloat(weightKg),
          activityLevel: activity,
          goal,
        };
        if (name.trim() !== user?.name) await api.me.patch({ name: name.trim() });
        await updateProfile(profile);
        go(6);
      } catch (err: any) {
        setError(`Couldn’t save your profile. ${err?.message ?? 'Try again.'}`);
      } finally {
        setBusy(false);
      }
      return;
    }
    go((step + 1) as Step);
  };

  const finish = async (enableReminders: boolean) => {
    setBusy(true);
    // The root layout's scheduling effect already ran (and skipped, no permission yet) when the
    // profile was saved, so schedule here right after the user grants permission.
    if (enableReminders && (await requestNotificationPermission())) {
      void registerPushToken();
      void syncNotificationSchedule(user?.notificationsPerDay ?? 10);
    }
    await refreshUser();
    router.replace('/(tabs)');
  };

  const isQuestion = step >= 1 && step <= QUESTION_COUNT;
  const cta: Record<Step, string> = {
    0: 'Get Started',
    1: 'Continue',
    2: 'Continue',
    3: 'Continue',
    4: 'Continue',
    5: 'Calculate My Budget',
    6: 'Continue',
    7: 'Turn On Reminders',
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        {isQuestion ? (
          <StepHeader step={step} total={QUESTION_COUNT} onBack={() => go((step - 1) as Step)} />
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={{
              flexGrow: 1,
              opacity: fade,
              transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }],
            }}
          >
            {step === 0 && <Welcome />}

            {step === 1 && (
              <>
                <Title title="What’s your name?" subtitle="Your coach will use it when it talks to you." />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="First name"
                  placeholderTextColor={ob.tertiary}
                  autoFocus
                  autoCapitalize="words"
                  autoComplete="given-name"
                  returnKeyType="next"
                  onSubmitEditing={next}
                  maxLength={40}
                  selectionColor={ob.label}
                  style={styles.nameInput}
                  accessibilityLabel="First name"
                />
                <View style={styles.nameRule} />
              </>
            )}

            {step === 2 && (
              <>
                <Title title="What’s your goal?" subtitle="This decides what counts as profit." />
                <ChoiceList options={GOALS} value={goal} onChange={setGoal} />
              </>
            )}

            {step === 3 && (
              <>
                <Title title="About you" subtitle="Used to calculate your daily budget." />
                <SectionLabel>Sex</SectionLabel>
                <Segmented
                  options={[
                    { id: 'male', label: 'Male' },
                    { id: 'female', label: 'Female' },
                  ]}
                  value={sex}
                  onChange={setSex}
                />
                <View style={styles.gap} />
                <View style={styles.group}>
                  <NumberRow label="Age" unit="yrs" value={age} onChange={setAge} min={13} max={100} last />
                </View>
              </>
            )}

            {step === 4 && (
              <>
                <Title title="Height and weight" subtitle="Only used to set your budget." />
                <View style={styles.group}>
                  <NumberRow label="Height" unit="cm" value={heightCm} onChange={setHeightCm} min={100} max={250} />
                  <NumberRow label="Weight" unit="kg" value={weightKg} onChange={setWeightKg} min={25} max={300} last />
                </View>
              </>
            )}

            {step === 5 && (
              <>
                <Title title="How active are you?" subtitle="Count workouts and everyday walking." />
                <ChoiceList options={ACTIVITY} value={activity} onChange={setActivity} />
              </>
            )}

            {step === 6 && user && (
              <BudgetReveal
                calories={user.targets.calories}
                proteinG={user.targets.proteinG}
                carbsG={user.targets.carbsG}
                fatG={user.targets.fatG}
                waterMl={user.targets.waterMl}
                line={BUDGET_LINE[goal]}
                animate={!reducedMotion}
              />
            )}

            {step === 7 && <Reminders />}

            <ErrorLine text={error} />
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            label={cta[step]}
            loading={busy}
            onPress={step === 7 ? () => void finish(true) : step === 6 ? () => go(7) : () => void next()}
          />
          {step === 7 ? <TextButton label="Not Now" onPress={() => void finish(false)} /> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** The whole product in one glance: a day's ledger. */
function Welcome() {
  return (
    <View style={styles.flex}>
      <View style={styles.brandRow}>
        <View style={styles.appTile}>
          <Text style={styles.appTileText}>H</Text>
        </View>
        <Text style={styles.wordmark}>Hisaab</Text>
      </View>
      <Text style={styles.heroTitle} accessibilityRole="header">
        Track food the way you track money.
      </Text>
      <Text style={styles.heroBody}>
        Every day starts with a calorie budget. Eat under it, and the day ends in profit.
      </Text>

      <View style={styles.ledger} accessible accessibilityLabel="Example day: budget 2,000, eaten 1,450, profit 550 calories">
        <LedgerRow label="Budget" value="2,000" />
        <LedgerRow label="Eaten" value="−1,450" />
        <View style={styles.ledgerRule} />
        <LedgerRow label="Profit" value="+550" total />
      </View>
    </View>
  );
}

function LedgerRow({ label, value, total }: { label: string; value: string; total?: boolean }) {
  return (
    <View style={styles.ledgerRow}>
      <Text style={[styles.ledgerLabel, total && styles.ledgerLabelTotal]}>{label}</Text>
      <Text style={[styles.ledgerValue, total && styles.ledgerValueTotal]}>
        {value}
        <Text style={styles.ledgerUnit}> kcal</Text>
      </Text>
    </View>
  );
}

function BudgetReveal(props: {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterMl: number;
  line: string;
  animate: boolean;
}) {
  const shown = useCountUp(props.calories, props.animate);
  const rows = [
    { label: 'Protein', value: `${props.proteinG} g`, color: colors.protein },
    { label: 'Carbs', value: `${props.carbsG} g`, color: colors.carbs },
    { label: 'Fat', value: `${props.fatG} g`, color: colors.fat },
    { label: 'Water', value: `${(props.waterMl / 1000).toFixed(1)} L`, color: colors.water },
  ];
  return (
    <View>
      <Title title="Your daily budget" subtitle="Based on your height, weight and activity." />
      <View accessible accessibilityLabel={`${props.calories} calories a day`}>
        <Text style={styles.budgetNumber}>{shown.toLocaleString('en-IN')}</Text>
        <Text style={styles.budgetUnit}>calories a day</Text>
      </View>

      <View style={[styles.group, styles.macroGroup]}>
        {rows.map((r, i) => (
          <View key={r.label} style={styles.macroRow}>
            <View style={[styles.macroDot, { backgroundColor: r.color }]} />
            <Text style={styles.macroLabel}>{r.label}</Text>
            <Text style={styles.macroValue}>{r.value}</Text>
            {i < rows.length - 1 ? <View style={styles.macroSeparator} /> : null}
          </View>
        ))}
      </View>

      <Text style={styles.budgetLine}>{props.line}</Text>
    </View>
  );
}

function useCountUp(target: number, animate: boolean) {
  const [value, setValue] = useState(animate ? 0 : target);
  useEffect(() => {
    if (!animate) return setValue(target);
    const start = Date.now();
    const duration = 900;
    let frame: number;
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, animate]);
  return value;
}

function Reminders() {
  return (
    <View>
      <Title
        title="Turn on reminders?"
        subtitle="A few nudges a day so no meal goes unlogged. Change how many anytime in Profile."
      />
      <NotificationPreview title="Lunch time. Log it?" body="Snap your plate. It takes two seconds." time="now" />
      <View style={styles.previewGap} />
      <NotificationPreview
        title="You’re 550 kcal in profit"
        body="Keep dinner light and the day stays green."
        time="2h ago"
        dim
      />
    </View>
  );
}

function NotificationPreview({ title, body, time, dim }: { title: string; body: string; time: string; dim?: boolean }) {
  return (
    <View style={[styles.notif, dim && { opacity: 0.55 }]} importantForAccessibility="no-hide-descendants">
      <View style={styles.notifIcon}>
        <Text style={styles.notifIconText}>H</Text>
      </View>
      <View style={styles.flex}>
        <View style={styles.notifTop}>
          <Text style={styles.notifApp}>Hisaab</Text>
          <Text style={styles.notifTime}>{time}</Text>
        </View>
        <Text style={styles.notifTitle}>{title}</Text>
        <Text style={styles.notifBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ob.bg },
  flex: { flex: 1 },
  headerSpacer: { height: 52 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  footer: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 12 },
  gap: { height: 28 },
  group: { backgroundColor: ob.group, borderRadius: 14, overflow: 'hidden' },

  // Name
  nameInput: {
    fontFamily: font.semibold,
    fontSize: 30,
    letterSpacing: -0.6,
    color: ob.label,
    paddingVertical: 8,
    paddingHorizontal: 0,
    outlineWidth: 0, // web: no browser focus ring
  },
  nameRule: { height: StyleSheet.hairlineWidth, backgroundColor: ob.separator },

  // Welcome
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  appTile: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: ob.profit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTileText: { fontFamily: font.heavy, fontSize: 19, color: '#FFFFFF' },
  wordmark: { fontFamily: font.bold, fontSize: 20, letterSpacing: -0.4, color: ob.label },
  heroTitle: {
    fontFamily: font.bold,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.4,
    color: ob.label,
    marginTop: 48,
  },
  heroBody: {
    fontFamily: font.regular,
    fontSize: 17,
    lineHeight: 25,
    letterSpacing: -0.2,
    color: ob.secondary,
    marginTop: 16,
    maxWidth: 340,
  },
  // Pinned to the bottom of the welcome screen, right above the button: the day's receipt.
  ledger: { marginTop: 'auto', paddingTop: 40 },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', paddingVertical: 8 },
  ledgerLabel: { fontFamily: font.regular, fontSize: 17, color: ob.secondary },
  ledgerLabelTotal: { fontFamily: font.semibold, color: ob.label },
  ledgerValue: {
    fontFamily: font.semibold,
    fontSize: 17,
    letterSpacing: -0.3,
    color: ob.label,
    fontVariant: ['tabular-nums'],
  },
  ledgerValueTotal: { fontFamily: font.bold, fontSize: 24, color: ob.profit },
  ledgerUnit: { fontFamily: font.regular, fontSize: 14, color: ob.secondary },
  ledgerRule: { height: StyleSheet.hairlineWidth, backgroundColor: ob.secondary, marginVertical: 6 },

  // Budget reveal
  budgetNumber: {
    fontFamily: font.heavy,
    fontSize: 84,
    lineHeight: 96,
    letterSpacing: -3.5,
    color: ob.label,
    fontVariant: ['tabular-nums'],
  },
  budgetUnit: { fontFamily: font.medium, fontSize: 17, color: ob.secondary, marginTop: 6 },
  macroGroup: { marginTop: 36 },
  macroRow: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16 },
  macroDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  macroLabel: { flex: 1, fontFamily: font.regular, fontSize: 17, letterSpacing: -0.3, color: ob.label },
  macroValue: { fontFamily: font.semibold, fontSize: 17, letterSpacing: -0.3, color: ob.label, fontVariant: ['tabular-nums'] },
  macroSeparator: {
    position: 'absolute',
    left: 38,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: ob.separator,
  },
  budgetLine: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: ob.secondary, marginTop: 16, marginLeft: 16 },

  // Reminders
  previewGap: { height: 8 },
  notif: { flexDirection: 'row', gap: 12, backgroundColor: ob.group, borderRadius: 20, padding: 14 },
  notifIcon: {
    width: 38,
    height: 38,
    borderRadius: 9,
    backgroundColor: ob.profit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notifIconText: { fontFamily: font.heavy, fontSize: 20, color: '#FFFFFF' },
  notifTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  notifApp: { fontFamily: font.semibold, fontSize: 13, color: ob.secondary },
  notifTime: { fontFamily: font.regular, fontSize: 13, color: ob.secondary },
  notifTitle: { fontFamily: font.semibold, fontSize: 15, letterSpacing: -0.2, color: ob.label, marginTop: 2 },
  notifBody: { fontFamily: font.regular, fontSize: 15, letterSpacing: -0.2, lineHeight: 20, color: '#D1D1D6' },
});

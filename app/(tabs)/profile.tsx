import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  TextInput,
  ActivityIndicator,
  Share,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { useAuth } from '../../src/auth/AuthContext';
import {
  useSubscription,
  useTrainerInviteCode,
  useTrainerClients,
  useLinkTrainer,
  useRevokeTrainer,
  useUnlinkClient,
  useSyncHealth,
} from '../../src/api/queries';
import { api } from '../../src/api/client';
import { PaywallModal } from '../../src/components/PaywallModal';
import { triggerTestNotification, syncNotificationSchedule } from '../../src/notifications/notificationService';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import {
  ChevronRight,
  Share2,
  Copy,
  Plus,
  Minus,
  X,
  Check,
} from 'lucide-react-native';
import { ChoiceList, Segmented, NumberRow, type Choice } from '../../src/onboarding/kit';
import { pnlText, pnlTone, toneColor } from '../../src/lib/pnl';
import type { ActivityLevel, Goal, Sex } from '../../src/api/hisaabApi';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, signOut } = useAuth();
  const { data: subData } = useSubscription();
  const { data: inviteData, refetch: refetchInvite } = useTrainerInviteCode();
  const { data: clientsData } = useTrainerClients();

  const linkTrainerMutation = useLinkTrainer();
  const revokeTrainerMutation = useRevokeTrainer();
  const unlinkClientMutation = useUnlinkClient();
  const syncHealthMutation = useSyncHealth();

  // Modals & local controls
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [editBudgetVisible, setEditBudgetVisible] = useState(false);
  const [trainerCodeInput, setTrainerCodeInput] = useState('');
  const [isLinkingTrainer, setIsLinkingTrainer] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [savingNotif, setSavingNotif] = useState(false);

  // Reminders: 0 per day = off (saved on the server, schedule re-synced on the phone)
  const notifCount = user?.notificationsPerDay ?? 5;
  const remindersOn = notifCount > 0;

  const handleNotifCountChange = async (newCount: number) => {
    const clamped = Math.max(0, Math.min(10, newCount));
    if (clamped === notifCount || savingNotif) return;
    setSavingNotif(true);
    try {
      await api.me.patch({ notificationsPerDay: clamped });
      await refreshUser();
      await syncNotificationSchedule(clamped);
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Try again');
    } finally {
      setSavingNotif(false);
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    try {
      const notif = await triggerTestNotification();
      Alert.alert('Notification sent', `"${notif.title}"\n${notif.body}`);
    } catch (err: any) {
      Alert.alert('Notification test failed', err?.message || 'Check permissions');
    } finally {
      setIsTestingNotif(false);
    }
  };

  const handleHealthToggle = (type: 'appleHealth' | 'healthConnect', val: boolean) => {
    api.healthSync.updateSettings({ [type]: val }).then(refreshUser);
    if (val) {
      Alert.alert(
        'Dev build required',
        'Direct HealthKit / Health Connect sync requires a native dev build. Use "Sync a demo workout" below to test the workout flow.'
      );
    }
  };

  const handleSyncDemoWorkout = () => {
    const fakeWorkout = {
      externalId: Crypto.randomUUID(),
      type: 'Running',
      durationMin: 35,
      caloriesBurned: 320,
      startedAt: new Date().toISOString(),
    };
    syncHealthMutation.mutate(
      {
        source: 'apple_health',
        workouts: [fakeWorkout],
      },
      {
        onSuccess: () => {
          Alert.alert('Workout synced', '+320 kcal bonus credit added to today’s ledger.');
        },
      }
    );
  };

  const handleShareInviteCode = async () => {
    if (!inviteData?.code) return;
    try {
      await Share.share({
        message: `Follow my daily log on Hisaab. My invite code is ${inviteData.code}`,
      });
    } catch (e) {
      console.warn('Share error', e);
    }
  };

  const handleCopyCode = async () => {
    if (!inviteData?.code) return;
    await Clipboard.setStringAsync(inviteData.code);
    Alert.alert('Code copied', inviteData.code);
  };

  const handleRevokeTrainers = () => {
    Alert.alert('Remove trainer access?', 'All trainer access will be removed and a new code will be generated.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          revokeTrainerMutation.mutate(undefined, {
            onSuccess: () => void refreshUser(),
            onError: (err: any) => Alert.alert('Error', err?.message || 'Try again'),
          }),
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with your email and password on any phone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  // Long-press a client (or use "Unlink" on their screen) to stop viewing their log.
  const handleUnlinkClient = (id: string, name: string) => {
    Alert.alert(`Unlink ${name}?`, `You’ll stop seeing ${name}’s log. They can share their code again anytime.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unlink',
        style: 'destructive',
        onPress: () =>
          unlinkClientMutation.mutate(id, {
            onError: (err: any) => Alert.alert('Couldn’t unlink', err?.message || 'Try again.'),
          }),
      },
    ]);
  };

  const handleLinkTrainer = () => {
    if (!trainerCodeInput.trim()) return;
    setIsLinkingTrainer(true);
    linkTrainerMutation.mutate(trainerCodeInput.trim(), {
      onSuccess: () => {
        setTrainerCodeInput('');
        setIsLinkingTrainer(false);
        Alert.alert('Success', 'Client linked successfully!');
      },
      onError: (err: any) => {
        setIsLinkingTrainer(false);
        Alert.alert('Error', err?.message || 'Invalid invite code');
      },
    });
  };

  const usage = subData?.usage;
  const scansUsed = usage?.scans?.used ?? 0;
  const chatsUsed = usage?.chats?.used ?? 0;
  const planLabel = subData?.isPro ? 'Hisaab Pro' : usage?.limitsEnabled ? 'Free plan' : 'Preview: no limits';
  const usageLine =
    usage?.limitsEnabled && !subData?.isPro
      ? `Today: ${scansUsed} of ${usage.scans.limit} photo scans, ${chatsUsed} of ${usage.chats.limit} coach chats`
      : `Today: ${scansUsed} photo scan${scansUsed === 1 ? '' : 's'}, ${chatsUsed} coach chat${chatsUsed === 1 ? '' : 's'}`;
  const clients = clientsData?.clients || [];

  const userName = user?.name || 'User';
  const initial = userName.charAt(0).toUpperCase();
  const goalLabel = user?.profile?.goal === 'gain' ? 'Gain muscle' : user?.profile?.goal === 'maintain' ? 'Maintain weight' : 'Lose weight';
  const weightLabel = `${user?.profile?.weightKg || 72} kg`;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.largeTitle}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header row: initial avatar, name, subtitle, chevron */}
        <TouchableOpacity
          style={styles.profileHeaderCard}
          onPress={() => setEditProfileVisible(true)}
          activeOpacity={0.7}
        >
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{initial}</Text>
          </View>
          <View style={styles.profileHeaderTextWrap}>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileSub}>{goalLabel}, {weightLabel}</Text>
          </View>
          <Text style={styles.editProfileLink}>Edit profile</Text>
          <ChevronRight size={18} color={colors.textDim} />
        </TouchableOpacity>

        {/* Daily budget group */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Daily budget</Text>
            <TouchableOpacity onPress={() => setEditBudgetVisible(true)} hitSlop={8}>
              <Text style={styles.sectionActionText}>Edit</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Calories</Text>
              <Text style={styles.rowValue}>{user?.targets?.calories?.toLocaleString() || 1860} kcal</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Protein</Text>
              <Text style={styles.rowValue}>{user?.targets?.proteinG || 137} g</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Carbs</Text>
              <Text style={styles.rowValue}>{user?.targets?.carbsG || 212} g</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Fat</Text>
              <Text style={styles.rowValue}>{user?.targets?.fatG || 52} g</Text>
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Water</Text>
              <Text style={styles.rowValue}>{((user?.targets?.waterMl || 2750) / 1000).toFixed(2)} L</Text>
            </View>
          </View>
        </View>

        {/* Plan group */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Plan</Text>
          <View style={styles.group}>
            <View style={styles.planUsageRow}>
              <Text style={styles.rowLabel}>{planLabel}</Text>
              <Text style={styles.rowDetailText}>{usageLine}</Text>
            </View>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.row}
              onPress={() => setPaywallVisible(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>See Hisaab Pro</Text>
              <ChevronRight size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Reminders group */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Reminders</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Meal reminders</Text>
              <Switch
                value={remindersOn}
                onValueChange={(on) => handleNotifCountChange(on ? 5 : 0)}
                disabled={savingNotif}
                trackColor={{ false: colors.control, true: colors.profit }}
                thumbColor="#FFFFFF"
              />
            </View>
            {remindersOn && (
              <>
                <View style={styles.separator} />
                <View style={styles.row}>
                  <Text style={styles.rowLabel}>Reminders per day</Text>
                  <View style={styles.stepperWrap}>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleNotifCountChange(Math.max(1, notifCount - 1))}
                      accessibilityLabel="Decrease reminders"
                    >
                      <Minus size={16} color={colors.text} strokeWidth={2.4} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{notifCount}</Text>
                    <TouchableOpacity
                      style={styles.stepperBtn}
                      onPress={() => handleNotifCountChange(notifCount + 1)}
                      accessibilityLabel="Increase reminders"
                    >
                      <Plus size={16} color={colors.text} strokeWidth={2.4} />
                    </TouchableOpacity>
                  </View>
                </View>
              </>
            )}
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.row}
              onPress={handleTestNotification}
              disabled={isTestingNotif}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>
                {isTestingNotif ? 'Sending reminder…' : 'Send a test reminder'}
              </Text>
              <ChevronRight size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Health group */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Health sync</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Apple Health</Text>
              <Switch
                value={Boolean(user?.healthSync?.appleHealth)}
                onValueChange={(val) => handleHealthToggle('appleHealth', val)}
                trackColor={{ false: colors.control, true: colors.profit }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.separator} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Health Connect</Text>
              <Switch
                value={Boolean(user?.healthSync?.healthConnect)}
                onValueChange={(val) => handleHealthToggle('healthConnect', val)}
                trackColor={{ false: colors.control, true: colors.profit }}
                thumbColor="#FFFFFF"
              />
            </View>
            <View style={styles.separator} />
            <TouchableOpacity
              style={styles.row}
              onPress={handleSyncDemoWorkout}
              activeOpacity={0.7}
            >
              <Text style={styles.rowLabel}>Sync a demo workout</Text>
              <ChevronRight size={18} color={colors.textDim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Trainer group */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Trainer</Text>
          <View style={styles.group}>
            {/* Share invite code */}
            <View style={styles.inviteRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowLabel}>Share with my trainer</Text>
                <Text style={styles.codeText}>{inviteData?.code || 'Loading…'}</Text>
              </View>
              <View style={styles.iconActions}>
                <TouchableOpacity style={styles.iconBtn} onPress={handleCopyCode} hitSlop={6}>
                  <Copy size={18} color={colors.text} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={handleShareInviteCode} hitSlop={6}>
                  <Share2 size={18} color={colors.text} />
                </TouchableOpacity>
              </View>
            </View>

            {inviteData && inviteData.trainerCount > 0 && (
              <>
                <View style={styles.separator} />
                <TouchableOpacity style={styles.row} onPress={handleRevokeTrainers}>
                  <Text style={[styles.rowLabel, { color: colors.loss }]}>Remove trainer access</Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.separator} />

            {/* Link a client */}
            <View style={styles.linkRow}>
              <TextInput
                style={styles.linkInput}
                placeholder="Enter a client’s code"
                placeholderTextColor={colors.textMute}
                value={trainerCodeInput}
                onChangeText={setTrainerCodeInput}
                autoCapitalize="characters"
                selectionColor="#FFFFFF"
              />
              <TouchableOpacity
                style={[styles.linkBtn, !trainerCodeInput.trim() && styles.linkBtnDisabled]}
                onPress={handleLinkTrainer}
                disabled={!trainerCodeInput.trim() || isLinkingTrainer}
              >
                {isLinkingTrainer ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <Text style={styles.linkBtnText}>Link</Text>
                )}
              </TouchableOpacity>
            </View>

            {/* Linked Clients */}
            {clients.map((c) => {
              const clientTone = c.today?.pnl ? pnlTone(c.today.pnl, c.goal) : 'even';
              const pnlTag = c.today?.pnl ? pnlText(c.today.pnl, c.goal, { they: true }) : 'Nothing logged';

              return (
                <View key={c.id}>
                  <View style={styles.separator} />
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => router.push(`/trainer/${c.id}` as any)}
                    onLongPress={() => handleUnlinkClient(c.id, c.name)}
                    accessibilityHint="Opens their day. Long-press to unlink."
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowLabel}>{c.name}</Text>
                      <Text
                        style={[
                          styles.rowDetailText,
                          { color: clientTone === 'even' ? colors.textDim : toneColor[clientTone] },
                        ]}
                      >
                        {pnlTag}
                      </Text>
                    </View>
                    <ChevronRight size={18} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        </View>

        {/* Account group */}
        <View style={styles.sectionWrap}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.group}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowValueDim} numberOfLines={1}>
                {user?.email ?? 'Not set'}
              </Text>
            </View>
            <View style={styles.separator} />
            <TouchableOpacity style={styles.row} onPress={handleSignOut} activeOpacity={0.7} accessibilityRole="button">
              <Text style={[styles.rowLabel, { color: colors.loss }]}>Sign Out</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editProfileVisible}
        onClose={() => setEditProfileVisible(false)}
      />

      {/* Edit Budget Modal */}
      <EditBudgetModal
        visible={editBudgetVisible}
        onClose={() => setEditBudgetVisible(false)}
      />

      {/* Paywall Modal */}
      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
      />
    </SafeAreaView>
  );
}

// ─── Edit Profile Modal ──────────────────────────────────────
const GOALS: Choice<Goal>[] = [
  { id: 'lose', title: 'Lose weight', detail: 'Target a calorie deficit to burn fat.' },
  { id: 'maintain', title: 'Maintain weight', detail: 'Stay at your current weight with steady energy.' },
  { id: 'gain', title: 'Gain muscle', detail: 'Eat a calorie surplus for strength and growth.' },
];

const ACTIVITIES: Choice<ActivityLevel>[] = [
  { id: 'sedentary', title: 'Sedentary', detail: 'Desk job, little intentional exercise' },
  { id: 'light', title: 'Lightly active', detail: '1–3 walks or light workouts a week' },
  { id: 'moderate', title: 'Moderately active', detail: '3–5 workouts a week' },
  { id: 'very_active', title: 'Very active', detail: 'Daily vigorous workouts or physical job' },
];

function EditProfileModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [goal, setGoal] = useState<Goal>(user?.profile?.goal || 'lose');
  const [sex, setSex] = useState<Sex>(user?.profile?.sex || 'male');
  const [age, setAge] = useState(String(user?.profile?.age || 28));
  const [heightCm, setHeightCm] = useState(String(user?.profile?.heightCm || 175));
  const [weightKg, setWeightKg] = useState(String(user?.profile?.weightKg || 72));
  const [activity, setActivity] = useState<ActivityLevel>(user?.profile?.activityLevel || 'moderate');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user) {
      setName(user.name || '');
      setGoal(user.profile?.goal || 'lose');
      setSex(user.profile?.sex || 'male');
      setAge(String(user.profile?.age || 28));
      setHeightCm(String(user.profile?.heightCm || 175));
      setWeightKg(String(user.profile?.weightKg || 72));
      setActivity(user.profile?.activityLevel || 'moderate');
    }
  }, [visible, user]);

  const handleSave = async () => {
    const a = parseInt(age, 10);
    const h = parseFloat(heightCm);
    const w = parseFloat(weightKg);
    const problem = !name.trim()
      ? 'Enter your name.'
      : isNaN(a) || a < 13 || a > 100
        ? 'Enter an age between 13 and 100.'
        : isNaN(h) || h < 100 || h > 250
          ? 'Enter a height between 100 and 250 cm.'
          : isNaN(w) || w < 25 || w > 300
            ? 'Enter a weight between 25 and 300 kg.'
            : null;
    if (problem) {
      Alert.alert('Check your details', problem);
      return;
    }
    try {
      setSaving(true);
      if (name.trim() !== user?.name) {
        await api.me.patch({ name: name.trim() });
      }
      const updatedUser = await updateProfile({
        goal,
        sex,
        age: a,
        heightCm: Math.round(h),
        weightKg: Math.round(w * 10) / 10,
        activityLevel: activity,
      });
      await refreshUser();
      setSaving(false);
      onClose();
      Alert.alert(
        'Profile updated',
        `New calculated daily budget: ${updatedUser.targets.calories.toLocaleString()} kcal`
      );
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Update failed', err?.message || 'Try again');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={modalStyles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Edit Profile</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <X size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[modalStyles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 80 }]}
            showsVerticalScrollIndicator={false}
          >
            {/* Name */}
            <Text style={modalStyles.sectionLabel}>Name</Text>
            <TextInput
              style={modalStyles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              placeholderTextColor={colors.textMute}
              selectionColor="#FFFFFF"
            />

            {/* Goal */}
            <Text style={modalStyles.sectionLabel}>Goal</Text>
            <ChoiceList options={GOALS} value={goal} onChange={setGoal} />

            {/* Sex */}
            <Text style={modalStyles.sectionLabel}>Sex</Text>
            <Segmented
              options={[
                { id: 'male', label: 'Male' },
                { id: 'female', label: 'Female' },
              ]}
              value={sex}
              onChange={setSex}
            />

            {/* Numbers: Age, Height, Weight */}
            <Text style={modalStyles.sectionLabel}>Measurements</Text>
            <View style={modalStyles.group}>
              <NumberRow label="Age" unit="yrs" value={age} onChange={setAge} min={13} max={100} />
              <NumberRow label="Height" unit="cm" value={heightCm} onChange={setHeightCm} min={100} max={250} />
              <NumberRow label="Weight" unit="kg" value={weightKg} onChange={setWeightKg} min={25} max={300} step={0.5} last />
            </View>

            {/* Activity Level */}
            <Text style={modalStyles.sectionLabel}>Activity level</Text>
            <ChoiceList options={ACTIVITIES} value={activity} onChange={setActivity} />
          </ScrollView>

          {/* Fixed Save Button */}
          <View style={[modalStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={modalStyles.saveBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={modalStyles.saveBtnText}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Edit Budget Modal ───────────────────────────────────────
function EditBudgetModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const { user, refreshUser, updateTargets } = useAuth();
  const [calories, setCalories] = useState(String(user?.targets?.calories || 1860));
  const [protein, setProtein] = useState(String(user?.targets?.proteinG || 137));
  const [carbs, setCarbs] = useState(String(user?.targets?.carbsG || 212));
  const [fat, setFat] = useState(String(user?.targets?.fatG || 52));
  const [water, setWater] = useState(String(user?.targets?.waterMl || 2750));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible && user?.targets) {
      setCalories(String(user.targets.calories));
      setProtein(String(user.targets.proteinG));
      setCarbs(String(user.targets.carbsG));
      setFat(String(user.targets.fatG));
      setWater(String(user.targets.waterMl));
    }
  }, [visible, user]);

  const handleSave = async () => {
    const t = {
      calories: parseInt(calories, 10),
      proteinG: parseInt(protein, 10),
      carbsG: parseInt(carbs, 10),
      fatG: parseInt(fat, 10),
      waterMl: parseInt(water, 10),
    };
    const out = (n: number, min: number, max: number) => isNaN(n) || n < min || n > max;
    const problem = out(t.calories, 800, 6000)
      ? 'Calories must be between 800 and 6,000 kcal.'
      : out(t.proteinG, 0, 500)
        ? 'Protein must be between 0 and 500 g.'
        : out(t.carbsG, 0, 1000)
          ? 'Carbs must be between 0 and 1,000 g.'
          : out(t.fatG, 0, 400)
            ? 'Fat must be between 0 and 400 g.'
            : out(t.waterMl, 500, 8000)
              ? 'Water must be between 500 and 8,000 ml.'
              : null;
    if (problem) {
      Alert.alert('Check your budget', problem);
      return;
    }
    try {
      setSaving(true);
      await updateTargets(t);
      await refreshUser();
      setSaving(false);
      onClose();
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Update failed', err?.message || 'Try again');
    }
  };

  const handleReset = async () => {
    try {
      setSaving(true);
      await updateTargets({ reset: true });
      await refreshUser();
      setSaving(false);
      onClose();
      Alert.alert('Reset', 'Daily budget reset to recommended targets.');
    } catch (err: any) {
      setSaving(false);
      Alert.alert('Reset failed', err?.message || 'Try again');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={modalStyles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={modalStyles.sheet}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>Edit Daily Budget</Text>
            <TouchableOpacity onPress={onClose} style={modalStyles.closeBtn}>
              <X size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView
            contentContainerStyle={[modalStyles.scrollContent, { paddingBottom: Math.max(insets.bottom, 16) + 120 }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={modalStyles.sectionLabel}>Targets</Text>
            <View style={modalStyles.group}>
              <NumberRow label="Calories" unit="kcal" value={calories} onChange={setCalories} min={800} max={6000} step={50} />
              <NumberRow label="Protein" unit="g" value={protein} onChange={setProtein} min={0} max={500} step={5} />
              <NumberRow label="Carbs" unit="g" value={carbs} onChange={setCarbs} min={0} max={1000} step={5} />
              <NumberRow label="Fat" unit="g" value={fat} onChange={setFat} min={0} max={400} step={5} />
              <NumberRow label="Water" unit="ml" value={water} onChange={setWater} min={500} max={8000} step={250} last />
            </View>

            <TouchableOpacity style={modalStyles.resetBtn} onPress={handleReset} disabled={saving}>
              <Text style={modalStyles.resetBtnText}>Reset to recommended</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Fixed Save Button */}
          <View style={[modalStyles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            <TouchableOpacity
              style={modalStyles.saveBtn}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              {saving ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={modalStyles.saveBtnText}>Save Budget</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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
  },
  largeTitle: {
    fontFamily: font.bold,
    fontSize: 34,
    letterSpacing: -0.8,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 100,
    gap: 24,
  },
  profileHeaderCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    fontFamily: font.bold,
    fontSize: 22,
    color: colors.text,
  },
  profileHeaderTextWrap: {
    flex: 1,
    gap: 2,
  },
  profileName: {
    fontFamily: font.bold,
    fontSize: 18,
    color: colors.text,
    letterSpacing: -0.3,
  },
  profileSub: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
  },
  editProfileLink: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textDim,
  },
  sectionWrap: {
    gap: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: colors.text,
    letterSpacing: -0.3,
  },
  sectionActionText: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.textDim,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 50,
  },
  rowLabel: {
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  rowValue: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  rowValueDim: {
    flexShrink: 1,
    marginLeft: 16,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.textDim,
  },
  planUsageRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  rowDetailText: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textDim,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  stepperWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
    fontVariant: ['tabular-nums'],
    minWidth: 20,
    textAlign: 'center',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  codeText: {
    fontFamily: font.bold,
    fontSize: 20,
    color: colors.profit,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 12,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  linkInput: {
    flex: 1,
    backgroundColor: colors.control,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.text,
  },
  linkBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnDisabled: {
    opacity: 0.35,
  },
  linkBtnText: {
    fontFamily: font.semibold,
    fontSize: 14,
    color: '#000000',
  },
});

const modalStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '92%',
    paddingTop: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 22,
    color: colors.text,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 12,
  },
  sectionLabel: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textDim,
    marginTop: 8,
    marginLeft: 4,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.text,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  resetBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  resetBtnText: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.textDim,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  saveBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: '#000000',
  },
});

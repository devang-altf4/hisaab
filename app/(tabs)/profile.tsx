import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { useAuth } from '../../src/auth/AuthContext';
import { useSubscription, useTrainerInviteCode, useTrainerClients, useLinkTrainer, useRevokeTrainer, useSyncHealth } from '../../src/api/queries';
import { api } from '../../src/api/client';
import { PnlBadge } from '../../src/components/PnlBadge';
import { PaywallModal } from '../../src/components/PaywallModal';
import { triggerTestNotification, syncNotificationSchedule } from '../../src/notifications/notificationService';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import * as Clipboard from 'expo-clipboard';
import {
  User as UserIcon,
  Crown,
  Bell,
  Heart,
  Users,
  ChevronRight,
  Sparkles,
  Share2,
  Copy,
  RefreshCw,
  Plus,
  Minus,
  Check,
} from 'lucide-react-native';

export default function ProfileScreen() {
  const { user, refreshUser, updateProfile, updateTargets } = useAuth();
  const { data: subData } = useSubscription();
  const { data: inviteData, refetch: refetchInvite } = useTrainerInviteCode();
  const { data: clientsData } = useTrainerClients();

  const linkTrainerMutation = useLinkTrainer();
  const revokeTrainerMutation = useRevokeTrainer();
  const syncHealthMutation = useSyncHealth();

  // Modals & local controls
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [trainerCodeInput, setTrainerCodeInput] = useState('');
  const [isLinkingTrainer, setIsLinkingTrainer] = useState(false);
  const [isTestingNotif, setIsTestingNotif] = useState(false);
  const [healthSyncDemoMsg, setHealthSyncDemoMsg] = useState<string | null>(null);

  // Stepper for notifications count
  const notifCount = user?.notificationsPerDay ?? 5;

  const handleNotifCountChange = async (newCount: number) => {
    const clamped = Math.max(0, Math.min(10, newCount));
    if (clamped === notifCount) return;
    try {
      await api.me.patch({ notificationsPerDay: clamped });
      await refreshUser();
      await syncNotificationSchedule(clamped);
    } catch (err: any) {
      Alert.alert('Update failed', err?.message || 'Try again');
    }
  };

  const handleTestNotification = async () => {
    setIsTestingNotif(true);
    try {
      const notif = await triggerTestNotification();
      Alert.alert('Notification Sent! 🔔', `"${notif.title}"\n${notif.body}`);
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
        'Direct HealthKit / Health Connect sync requires a native dev build. You can use the "Sync demo workout" button below to test the bonus credit flow in Expo Go!'
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
        onSuccess: (data) => {
          setHealthSyncDemoMsg(`Demo workout synced! (+320 kcal bonus credit added)`);
          setTimeout(() => setHealthSyncDemoMsg(null), 4000);
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
    Alert.alert('Remove trainer access?', 'Sab trainers ka access hat jayega aur naya code banega.', [
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

  const isPro = subData?.isPro || user?.isPro || false;
  const scansUsed = subData?.usage?.scans?.used ?? 0;
  const scansLimit = subData?.usage?.scans?.limit ?? 3;
  const chatsUsed = subData?.usage?.chats?.used ?? 0;
  const chatsLimit = subData?.usage?.chats?.limit ?? 5;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profile & Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Profile Card */}
        <View style={styles.card}>
          <View style={styles.profileHeader}>
            <View style={styles.avatarBox}>
              <UserIcon size={28} color={colors.text} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.userName}>{user?.name || 'Hisaab User'}</Text>
              <Text style={styles.userSub}>
                Goal: {user?.profile?.goal ? user.profile.goal.toUpperCase() : 'LOSE'} ·{' '}
                {user?.profile?.weightKg || 75} kg · {user?.profile?.heightCm || 175} cm
              </Text>
            </View>
          </View>

          <View style={styles.targetsRow}>
            <View style={styles.targetItem}>
              <Text style={styles.targetItemLabel}>Daily Capital</Text>
              <Text style={styles.targetItemVal}>{user?.targets?.calories || 1850} kcal</Text>
            </View>
            <View style={styles.targetItem}>
              <Text style={styles.targetItemLabel}>Protein</Text>
              <Text style={[styles.targetItemVal, { color: colors.protein }]}>
                {user?.targets?.proteinG || 140}g
              </Text>
            </View>
            <View style={styles.targetItem}>
              <Text style={styles.targetItemLabel}>Water Target</Text>
              <Text style={[styles.targetItemVal, { color: colors.water }]}>
                {user?.targets?.waterMl || 2500} ml
              </Text>
            </View>
          </View>
        </View>

        {/* Plan & Usage Card */}
        <View style={[styles.card, isPro && styles.proCard]}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.rowAlign}>
              <Crown size={20} color={isPro ? colors.accent : colors.textMute} />
              <Text style={styles.cardSectionTitle}>{isPro ? 'Pro Member' : 'Free Plan'}</Text>
            </View>
            <View style={[styles.planBadge, isPro && styles.planBadgePro]}>
              <Text style={[styles.planBadgeText, isPro && styles.planBadgeTextPro]}>
                {isPro ? 'ACTIVE PRO' : 'FREE TIER'}
              </Text>
            </View>
          </View>

          <Text style={styles.usageText}>
            {subData?.usage?.limitsEnabled === false
              ? `Today: ${scansUsed} scans, ${chatsUsed} coach chats. No limits during the preview.`
              : `Today's Usage: Scans ${scansUsed}/${isPro ? 'Unlimited' : scansLimit} · Chats ${chatsUsed}/${isPro ? 'Unlimited' : chatsLimit}`}
          </Text>

          {!isPro ? (
            <TouchableOpacity
              style={styles.upgradeBtn}
              onPress={() => setPaywallVisible(true)}
              activeOpacity={0.8}
            >
              <Sparkles size={16} color="#000" />
              <Text style={styles.upgradeBtnText}>Upgrade to Pro</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.proUntilText}>
              Valid until: {user?.proUntil ? new Date(user.proUntil).toLocaleDateString() : 'Active'}
            </Text>
          )}
        </View>

        {/* Zomato-style Notifications Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.rowAlign}>
              <Bell size={20} color={colors.accent} />
              <Text style={styles.cardSectionTitle}>Zomato-Style Nudges</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Notifications per day</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleNotifCountChange(notifCount - 1)}
              >
                <Minus size={16} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.stepperVal}>{notifCount}</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleNotifCountChange(notifCount + 1)}
              >
                <Plus size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.testNotifBtn}
            onPress={handleTestNotification}
            disabled={isTestingNotif}
          >
            {isTestingNotif ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.testNotifBtnText}>Test Zomato-style notification 🔔</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Health Sync Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.rowAlign}>
              <Heart size={20} color={colors.protein} />
              <Text style={styles.cardSectionTitle}>Health Sync</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Apple Health</Text>
              <Text style={styles.settingSub}>Auto-import workouts for bonus credit</Text>
            </View>
            <Switch
              value={user?.healthSync?.appleHealth ?? false}
              onValueChange={(v) => handleHealthToggle('appleHealth', v)}
              trackColor={{ false: colors.cardAlt, true: colors.profit }}
            />
          </View>

          <View style={styles.settingRow}>
            <View>
              <Text style={styles.settingLabel}>Health Connect (Android)</Text>
              <Text style={styles.settingSub}>Sync Google Fit / Health Connect</Text>
            </View>
            <Switch
              value={user?.healthSync?.healthConnect ?? false}
              onValueChange={(v) => handleHealthToggle('healthConnect', v)}
              trackColor={{ false: colors.cardAlt, true: colors.profit }}
            />
          </View>

          <TouchableOpacity
            style={styles.demoSyncBtn}
            onPress={handleSyncDemoWorkout}
            disabled={syncHealthMutation.isPending}
          >
            {syncHealthMutation.isPending ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.demoSyncBtnText}>Sync demo workout (+320 kcal bonus) ⚡</Text>
            )}
          </TouchableOpacity>
          {healthSyncDemoMsg && <Text style={styles.healthSuccessMsg}>{healthSyncDemoMsg}</Text>}
        </View>

        {/* Trainer Section */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <View style={styles.rowAlign}>
              <Users size={20} color={colors.fat} />
              <Text style={styles.cardSectionTitle}>Trainer Connection</Text>
            </View>
          </View>

          {/* Share code with trainer */}
          <View style={styles.trainerBox}>
            <Text style={styles.trainerBoxTitle}>SHARE WITH MY TRAINER</Text>
            <Text style={styles.trainerBoxSub}>
              Give this code to your trainer so they can see your daily log.
            </Text>

            <View style={styles.codeRow}>
              <Text style={styles.inviteCodeText}>
                {inviteData?.code || user?.trainerInviteCode || '----'}
              </Text>
              <TouchableOpacity style={styles.codeBtn} onPress={handleShareInviteCode}>
                <Share2 size={16} color={colors.text} />
              </TouchableOpacity>
              <TouchableOpacity style={styles.codeBtn} onPress={handleCopyCode}>
                <Copy size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
            {(inviteData?.trainerCount ?? 0) > 0 && (
              <TouchableOpacity onPress={handleRevokeTrainers} disabled={revokeTrainerMutation.isPending}>
                <Text style={[styles.trainerBoxSub, { color: colors.loss, marginTop: spacing.sm }]}>
                  {inviteData!.trainerCount} trainer{inviteData!.trainerCount > 1 ? 's' : ''} linked · Remove access
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* I am a trainer section */}
          <View style={[styles.trainerBox, { marginTop: spacing.md }]}>
            <Text style={styles.trainerBoxTitle}>I'M A TRAINER (LINK CLIENT)</Text>
            <View style={styles.linkRow}>
              <TextInput
                style={styles.trainerInput}
                placeholder="Enter client's invite code"
                placeholderTextColor={colors.textMute}
                value={trainerCodeInput}
                onChangeText={setTrainerCodeInput}
                autoCapitalize="characters"
              />
              <TouchableOpacity
                style={styles.linkBtn}
                onPress={handleLinkTrainer}
                disabled={isLinkingTrainer || !trainerCodeInput.trim()}
              >
                {isLinkingTrainer ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <Text style={styles.linkBtnText}>Link</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Linked Clients List */}
          {clientsData?.clients && clientsData.clients.length > 0 && (
            <View style={{ marginTop: spacing.lg }}>
              <Text style={styles.trainerBoxTitle}>MY LINKED CLIENTS</Text>
              {clientsData.clients.map((client) => (
                <TouchableOpacity
                  key={client.id}
                  style={styles.clientItem}
                  activeOpacity={0.7}
                  onPress={() => router.push(`/trainer/${client.id}` as any)}
                >
                  <View>
                    <Text style={styles.clientName}>{client.name}</Text>
                    <Text style={styles.clientSub}>
                      {client.today.meals} meals today · {client.today.caloriesLeft} kcal balance
                    </Text>
                  </View>
                  <View style={styles.rowAlign}>
                    <PnlBadge pnl={client.today.pnl} size="sm" />
                    <ChevronRight size={16} color={colors.textMute} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Reusable Paywall Modal */}
      <PaywallModal visible={paywallVisible} onClose={() => setPaywallVisible(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.text,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 100,
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  proCard: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
    backgroundColor: 'rgba(245, 158, 11, 0.05)',
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarBox: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  userName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  userSub: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
  },
  targetsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  targetItem: {
    alignItems: 'center',
  },
  targetItemLabel: {
    fontSize: 11,
    color: colors.textMute,
  },
  targetItemVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  rowAlign: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  planBadge: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  planBadgePro: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textDim,
  },
  planBadgeTextPro: {
    color: colors.accent,
  },
  usageText: {
    fontSize: 13,
    color: colors.textDim,
    marginBottom: spacing.md,
  },
  upgradeBtn: {
    backgroundColor: colors.accent,
    paddingVertical: 12,
    borderRadius: radii.button,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  upgradeBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
  proUntilText: {
    fontSize: 12,
    color: colors.profit,
    fontWeight: '600',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  settingSub: {
    fontSize: 11,
    color: colors.textMute,
    marginTop: 2,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepperBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  stepperVal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  testNotifBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.cardAlt,
    paddingVertical: 12,
    borderRadius: radii.button,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  testNotifBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  demoSyncBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.cardAlt,
    paddingVertical: 12,
    borderRadius: radii.button,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  demoSyncBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accent,
  },
  healthSuccessMsg: {
    fontSize: 12,
    color: colors.profit,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '600',
  },
  trainerBox: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  trainerBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  trainerBoxSub: {
    fontSize: 12,
    color: colors.textDim,
    marginBottom: spacing.md,
    lineHeight: 16,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inviteCodeText: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: colors.accent,
    letterSpacing: 2,
  },
  codeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  linkRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  trainerInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
  },
  linkBtn: {
    backgroundColor: colors.profit,
    paddingHorizontal: 18,
    borderRadius: radii.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000',
  },
  clientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  clientSub: {
    fontSize: 12,
    color: colors.textMute,
    marginTop: 2,
  },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { X, Check, Sparkles, Crown } from 'lucide-react-native';
import { useSubscription, useMockUpgrade } from '../api/queries';
import { useAuth } from '../auth/AuthContext';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose, reason }) => {
  const [selectedPlanId, setSelectedPlanId] = useState<'pro_monthly' | 'pro_yearly'>('pro_yearly');
  const { data: subData, isLoading } = useSubscription();
  const mockUpgradeMutation = useMockUpgrade();
  const { refreshUser } = useAuth();

  const handleUpgrade = () => {
    mockUpgradeMutation.mutate(selectedPlanId, {
      onSuccess: async () => {
        await refreshUser();
        onClose();
      },
    });
  };

  const plans = subData?.plans || [
    { id: 'pro_monthly' as const, name: 'Pro Monthly', priceInr: 149, period: 'month', days: 30, badge: null },
    { id: 'pro_yearly' as const, name: 'Pro Yearly', priceInr: 999, period: 'year', days: 365, badge: 'Save 44%' },
  ];

  const features = subData?.features || [
    '60 AI meal scans a day (free: 3)',
    '150 coach chats a day (free: 5)',
    'Trainer sharing & weekly P&L reports',
    'Smart meal reminders',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Close button */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <X size={20} color={colors.textDim} />
          </TouchableOpacity>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Header / Crown */}
            <View style={styles.header}>
              <View style={styles.crownCircle}>
                <Crown size={32} color={colors.accent} />
              </View>
              <Text style={styles.headline}>Upgrade to Pro</Text>
              <Text style={styles.subheadline}>
                {reason || 'More meal scans, more coach chats, and trainer sharing.'}
              </Text>
            </View>

            {/* Benefits List */}
            <View style={styles.benefitsContainer}>
              {features.map((feat, idx) => (
                <View key={idx} style={styles.benefitRow}>
                  <View style={styles.checkCircle}>
                    <Check size={14} color={colors.profit} />
                  </View>
                  <Text style={styles.benefitText}>{feat}</Text>
                </View>
              ))}
            </View>

            {/* Plans Selection */}
            <Text style={styles.plansHeader}>CHOOSE YOUR PASS</Text>
            {isLoading ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 20 }} />
            ) : (
              <View style={styles.plansContainer}>
                {plans.map((p) => {
                  const isSelected = selectedPlanId === p.id;
                  return (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.planCard, isSelected && styles.planCardSelected]}
                      onPress={() => setSelectedPlanId(p.id as any)}
                      activeOpacity={0.8}
                    >
                      {p.badge && (
                        <View style={styles.saveBadge}>
                          <Text style={styles.saveBadgeText}>{p.badge}</Text>
                        </View>
                      )}
                      <View style={styles.planInfo}>
                        <Text style={styles.planName}>{p.name}</Text>
                        <Text style={styles.planDays}>{p.days} days access</Text>
                      </View>
                      <View style={styles.priceContainer}>
                        <Text style={styles.priceText}>₹{p.priceInr}</Text>
                        <Text style={styles.periodText}>/{p.period}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* CTA Button */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handleUpgrade}
              disabled={mockUpgradeMutation.isPending}
              activeOpacity={0.8}
            >
              {mockUpgradeMutation.isPending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Sparkles size={18} color="#000" />
                  <Text style={styles.ctaButtonText}>Start Pro (test mode)</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNotice}>
              Test mode: Instant mock upgrade without real card billing.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.xl,
    maxHeight: '90%',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  closeBtn: {
    position: 'absolute',
    top: spacing.lg,
    right: spacing.lg,
    zIndex: 10,
    padding: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.cardAlt,
  },
  header: {
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  crownCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  subheadline: {
    fontSize: 14,
    color: colors.textDim,
    textAlign: 'center',
    marginTop: 6,
    paddingHorizontal: spacing.md,
    lineHeight: 20,
  },
  benefitsContainer: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.card,
    padding: spacing.lg,
    marginVertical: spacing.md,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
    flex: 1,
  },
  plansHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  plansContainer: {
    gap: 10,
    marginBottom: spacing.lg,
  },
  planCard: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.card,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  saveBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: colors.accent,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderBottomLeftRadius: 10,
  },
  saveBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000',
  },
  planInfo: {},
  planName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  planDays: {
    fontSize: 12,
    color: colors.textMute,
    marginTop: 2,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  periodText: {
    fontSize: 13,
    color: colors.textDim,
  },
  ctaButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.button,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  ctaButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000',
  },
  footerNotice: {
    fontSize: 11,
    color: colors.textMute,
    textAlign: 'center',
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
});


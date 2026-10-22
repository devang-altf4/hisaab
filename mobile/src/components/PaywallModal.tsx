import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
import { X, Check } from 'lucide-react-native';
import { useSubscription, useMockUpgrade } from '../api/queries';
import { useAuth } from '../auth/AuthContext';

interface PaywallModalProps {
  visible: boolean;
  onClose: () => void;
  reason?: string;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ visible, onClose, reason }) => {
  const insets = useSafeAreaInsets();
  const [selectedPlanId, setSelectedPlanId] = useState<'pro_yearly' | 'pro_monthly'>('pro_yearly');
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

  const checklist = [
    '60 photo scans a day (free: 3)',
    '150 coach chats a day (free: 5)',
    'Share your log with a trainer',
    'Smart meal reminders',
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Hisaab Pro</Text>
              <Text style={styles.subtitle}>{reason || 'More scans, more coaching.'}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Checklist */}
            <View style={styles.checklist}>
              {checklist.map((item, idx) => (
                <View key={idx} style={styles.checkItem}>
                  <View style={styles.checkIcon}>
                    <Check size={16} color={colors.profit} strokeWidth={2.4} />
                  </View>
                  <Text style={styles.checkText}>{item}</Text>
                </View>
              ))}
            </View>

            {/* Plan selection */}
            <View style={styles.plansGroup}>
              {/* Yearly plan */}
              <TouchableOpacity
                style={[styles.planRow, selectedPlanId === 'pro_yearly' && styles.planRowSelected]}
                onPress={() => setSelectedPlanId('pro_yearly')}
                activeOpacity={0.7}
              >
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>Yearly</Text>
                  <Text style={styles.planPrice}>₹999 / year</Text>
                </View>
                <View style={styles.planRight}>
                  <View style={styles.saveTag}>
                    <Text style={styles.saveTagText}>Save 44%</Text>
                  </View>
                  <View style={[styles.radioCircle, selectedPlanId === 'pro_yearly' && styles.radioCircleOn]}>
                    {selectedPlanId === 'pro_yearly' && <View style={styles.radioDot} />}
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.separator} />

              {/* Monthly plan */}
              <TouchableOpacity
                style={[styles.planRow, selectedPlanId === 'pro_monthly' && styles.planRowSelected]}
                onPress={() => setSelectedPlanId('pro_monthly')}
                activeOpacity={0.7}
              >
                <View style={styles.planInfo}>
                  <Text style={styles.planTitle}>Monthly</Text>
                  <Text style={styles.planPrice}>₹149 / month</Text>
                </View>
                <View style={styles.planRight}>
                  <View style={[styles.radioCircle, selectedPlanId === 'pro_monthly' && styles.radioCircleOn]}>
                    {selectedPlanId === 'pro_monthly' && <View style={styles.radioDot} />}
                  </View>
                </View>
              </TouchableOpacity>
            </View>

            {/* Start Pro button */}
            <TouchableOpacity
              style={styles.ctaBtn}
              onPress={handleUpgrade}
              disabled={mockUpgradeMutation.isPending}
              activeOpacity={0.85}
            >
              {mockUpgradeMutation.isPending ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.ctaBtnText}>Start Pro</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.footerNote}>Test mode. No payment is taken.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: 16 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 26,
    color: colors.text,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDim,
    marginTop: 4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    gap: 20,
  },
  checklist: {
    gap: 12,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  checkIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text,
    letterSpacing: -0.2,
  },
  plansGroup: {
    backgroundColor: colors.control,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  planRowSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  planInfo: {
    gap: 2,
  },
  planTitle: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
  },
  planPrice: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
  },
  planRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  saveTag: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  saveTagText: {
    fontFamily: font.semibold,
    fontSize: 12,
    color: colors.profit,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleOn: {
    borderColor: '#FFFFFF',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginLeft: 16,
  },
  ctaBtn: {
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: '#000000',
  },
  footerNote: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textDim,
    textAlign: 'center',
    marginBottom: 8,
  },
});

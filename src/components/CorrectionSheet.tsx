import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { X } from 'lucide-react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { useCorrectMeal } from '../api/queries';
import type { Meal } from '../api/hisaabApi';

interface CorrectionSheetProps {
  visible: boolean;
  meal: Meal;
  onClose: () => void;
  /** "Edit the numbers myself" → the screen's manual edit mode */
  onEditNumbers: () => void;
}

/**
 * P1 "Wrong?" — the user says what it really is; the AI redoes the meal using the stored
 * photo plus these details as the source of truth (~2–4 s). On failure the meal is unchanged.
 */
export const CorrectionSheet: React.FC<CorrectionSheetProps> = ({ visible, meal, onClose, onEditNumbers }) => {
  const insets = useSafeAreaInsets();
  const mutation = useCorrectMeal();
  const [name, setName] = useState(meal.dishName);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fresh form every time the sheet opens.
  useEffect(() => {
    if (visible) {
      setName(meal.dishName);
      setQuantity('');
      setNotes('');
      setError(null);
    }
  }, [visible, meal.dishName]);

  const nameChanged = name.trim() !== '' && name.trim() !== meal.dishName.trim();
  const canSubmit = (nameChanged || quantity.trim() !== '' || notes.trim() !== '') && !mutation.isPending;

  const submit = () => {
    if (!canSubmit) return;
    setError(null);
    mutation.mutate(
      {
        id: meal.id,
        ...(nameChanged ? { name: name.trim() } : {}),
        ...(quantity.trim() ? { quantity: quantity.trim() } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      },
      {
        onSuccess: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onClose();
        },
        onError: (err: any) => setError(err?.message || 'Couldn’t recalculate. Try again.'),
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={mutation.isPending ? undefined : onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior="padding" style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title} accessibilityRole="header">
              What’s wrong?
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={12} disabled={mutation.isPending} accessibilityLabel="Close">
              <X size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>
          <Text style={styles.subtitle}>
            Tell us what it really is. AI will recalculate using your photo and these details.
          </Text>

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.form} contentContainerStyle={{ gap: spacing.md }}>
            <Field label="What is it?" value={name} onChangeText={setName} placeholder="e.g. Paneer tikka" />
            <Field
              label="How much?"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 4 skewers, 1 plate rice"
              autoFocus
            />
            <Field
              label="Anything else? (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="e.g. cooked in butter, no oil, half portion"
              multiline
            />
            {error ? (
              <Text style={styles.error} accessibilityLiveRegion="polite">
                {error}
              </Text>
            ) : null}
          </ScrollView>

          <TouchableOpacity
            style={[styles.primary, !canSubmit && styles.primaryDisabled]}
            onPress={submit}
            disabled={!canSubmit}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: mutation.isPending }}
          >
            {mutation.isPending ? (
              <View style={styles.row}>
                <ActivityIndicator color="#000" size="small" />
                <Text style={styles.primaryText}>Recalculating…</Text>
              </View>
            ) : (
              <Text style={styles.primaryText}>Recalculate</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              onClose();
              onEditNumbers();
            }}
            disabled={mutation.isPending}
            style={styles.linkBtn}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Edit the items myself</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

function Field(props: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
  multiline?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={colors.textMute}
        multiline={props.multiline}
        autoFocus={props.autoFocus}
        maxLength={props.multiline ? 300 : 80}
        style={[styles.input, props.multiline && styles.inputMulti]}
        selectionColor={colors.text}
        accessibilityLabel={props.label}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.xl,
    paddingTop: 10,
    maxHeight: '90%',
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: colors.border, marginBottom: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, lineHeight: 20, color: colors.textDim, marginTop: 4, marginBottom: spacing.lg },
  form: { flexGrow: 0 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  },
  inputMulti: { minHeight: 76, textAlignVertical: 'top' },
  error: { fontSize: 14, lineHeight: 20, color: colors.loss },
  primary: {
    marginTop: spacing.lg,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.35 },
  primaryText: { fontSize: 16, fontWeight: '700', color: '#000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBtn: { alignItems: 'center', paddingVertical: 12 },
  link: { fontSize: 15, fontWeight: '600', color: colors.textDim },
});

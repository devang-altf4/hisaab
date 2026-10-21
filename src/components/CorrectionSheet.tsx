import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
import { useCorrectMeal } from '../api/queries';
import type { Meal } from '../api/hisaabApi';

interface CorrectionSheetProps {
  visible: boolean;
  meal: Meal;
  onClose: () => void;
  /** "Edit the items myself" → open edit mode */
  onEditNumbers: () => void;
}

export const CorrectionSheet: React.FC<CorrectionSheetProps> = ({ visible, meal, onClose, onEditNumbers }) => {
  const insets = useSafeAreaInsets();
  const mutation = useCorrectMeal();
  const [name, setName] = useState(meal.dishName);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
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

          <ScrollView keyboardShouldPersistTaps="handled" style={styles.form} contentContainerStyle={{ gap: 14 }}>
            <Field label="What is it?" value={name} onChangeText={setName} placeholder="e.g. Paneer tikka" />
            <Field
              label="How much?"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="e.g. 4 skewers, 1 plate rice"
              autoFocus
            />
            <Field
              label="Anything else?"
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
                <ActivityIndicator color="#000000" size="small" />
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
        selectionColor="#FFFFFF"
        accessibilityLabel={props.label}
      />
    </View>
  );
}

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
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontFamily: font.bold, fontSize: 24, letterSpacing: -0.5, color: colors.text },
  subtitle: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: colors.textDim, marginTop: 4, marginBottom: 16 },
  form: { flexGrow: 0 },
  label: { fontFamily: font.medium, fontSize: 14, color: colors.textDim, letterSpacing: -0.1 },
  input: {
    backgroundColor: colors.control,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text,
  },
  inputMulti: { minHeight: 80, textAlignVertical: 'top' },
  error: { fontFamily: font.medium, fontSize: 14, lineHeight: 20, color: colors.loss },
  primary: {
    marginTop: 20,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDisabled: { opacity: 0.35 },
  primaryText: { fontFamily: font.semibold, fontSize: 17, color: '#000000' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkBtn: { alignItems: 'center', paddingVertical: 14 },
  link: { fontFamily: font.medium, fontSize: 16, color: colors.textDim },
});

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
import { X, Trash2 } from 'lucide-react-native';
import { useWorkouts, useLogWorkout, useDeleteWorkout } from '../api/queries';

interface WorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  date?: string;
}

const WORKOUT_TYPES = [
  'Walking',
  'Running',
  'Gym',
  'Yoga',
  'Cricket',
  'Badminton',
  'Cycling',
  'HIIT',
  'Dance',
];

const DURATIONS = [15, 30, 45, 60, 90];

export const WorkoutModal: React.FC<WorkoutModalProps> = ({ visible, onClose, date }) => {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState('Walking');
  const [duration, setDuration] = useState(30);
  const [caloriesOverride, setCaloriesOverride] = useState('');

  const { data: workoutsData, isLoading: isLoadingWorkouts } = useWorkouts(date);
  const logWorkoutMutation = useLogWorkout();
  const deleteWorkoutMutation = useDeleteWorkout();

  const handleLog = () => {
    const customBurn = caloriesOverride.trim() ? parseInt(caloriesOverride, 10) : undefined;
    logWorkoutMutation.mutate(
      {
        type: selectedType,
        durationMin: duration,
        caloriesBurned: isNaN(customBurn as any) ? undefined : customBurn,
        date,
      },
      {
        onSuccess: () => {
          setCaloriesOverride('');
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteWorkoutMutation.mutate(id);
  };

  const workouts = workoutsData?.workouts || [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={styles.sheetWrap} pointerEvents="box-none">
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Log a Workout</Text>
              <Text style={styles.subtitle}>Calories you burn are added to today’s budget.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close">
              <X size={22} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
            {/* Activity chips */}
            <Text style={styles.sectionLabel}>Activity</Text>
            <View style={styles.chipsWrap}>
              {WORKOUT_TYPES.map((type) => {
                const isSelected = selectedType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelectedType(type)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Duration chips */}
            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.durationRow}>
              {DURATIONS.map((d) => {
                const isSelected = duration === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.durationChip, isSelected && styles.chipSelected]}
                    onPress={() => setDuration(d)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                      {d} min
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Calories burned field */}
            <Text style={styles.sectionLabel}>Calories burned</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              placeholder="Auto-estimated"
              placeholderTextColor={colors.textMute}
              value={caloriesOverride}
              onChangeText={setCaloriesOverride}
              selectionColor="#FFFFFF"
            />

            {/* White Log Workout button */}
            <TouchableOpacity
              style={styles.logBtn}
              onPress={handleLog}
              disabled={logWorkoutMutation.isPending}
              activeOpacity={0.85}
            >
              {logWorkoutMutation.isPending ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.logBtnText}>Log Workout</Text>
              )}
            </TouchableOpacity>

            {/* Today's workouts list */}
            {workouts.length > 0 && (
              <View style={styles.listSection}>
                <Text style={styles.sectionLabel}>Today</Text>
                <View style={styles.group}>
                  {workouts.map((w, idx) => (
                    <View key={w.id} style={styles.workoutRowWrap}>
                      <View style={styles.workoutRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.workoutName}>{w.type}</Text>
                          <Text style={styles.workoutSub}>{w.durationMin} min</Text>
                        </View>
                        <Text style={styles.workoutKcal}>+{w.caloriesBurned} kcal</Text>
                        <TouchableOpacity
                          onPress={() => handleDelete(w.id)}
                          style={styles.deleteBtn}
                          accessibilityLabel={`Delete ${w.type} workout`}
                        >
                          <Trash2 size={18} color={colors.loss} />
                        </TouchableOpacity>
                      </View>
                      {idx < workouts.length - 1 && <View style={styles.separator} />}
                    </View>
                  ))}
                </View>
              </View>
            )}
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
    marginBottom: 16,
  },
  title: {
    fontFamily: font.bold,
    fontSize: 24,
    color: colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontFamily: font.regular,
    fontSize: 14,
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
    gap: 12,
  },
  sectionLabel: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textDim,
    letterSpacing: -0.1,
    marginTop: 4,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radii.pill,
    backgroundColor: colors.control,
  },
  chipSelected: {
    backgroundColor: '#FFFFFF',
  },
  chipText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.text,
    letterSpacing: -0.1,
  },
  chipTextSelected: {
    color: '#000000',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
  },
  durationChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.control,
  },
  input: {
    backgroundColor: colors.control,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.text,
  },
  logBtn: {
    marginTop: 10,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: '#000000',
  },
  listSection: {
    marginTop: 12,
    gap: 8,
  },
  group: {
    backgroundColor: colors.control,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  workoutRowWrap: {
    position: 'relative',
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  workoutName: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
  },
  workoutSub: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  workoutKcal: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.profit,
    fontVariant: ['tabular-nums'],
  },
  deleteBtn: {
    padding: 6,
  },
  separator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
});

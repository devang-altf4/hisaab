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
} from 'react-native';
import { colors, radii, spacing } from '../theme/tokens';
import { X, Plus, Trash2, Flame, Clock } from 'lucide-react-native';
import { useWorkouts, useLogWorkout, useDeleteWorkout } from '../api/queries';

interface WorkoutModalProps {
  visible: boolean;
  onClose: () => void;
  date?: string;
}

const WORKOUT_TYPES = [
  'Walking',
  'Running',
  'Gym/Strength',
  'Yoga',
  'Cricket',
  'Badminton',
  'Cycling',
  'HIIT',
  'Dance',
];

export const WorkoutModal: React.FC<WorkoutModalProps> = ({ visible, onClose, date }) => {
  const [selectedType, setSelectedType] = useState('Walking');
  const [duration, setDuration] = useState(30);
  const [caloriesOverride, setCaloriesOverride] = useState('');
  const [notes, setNotes] = useState('');

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
        notes: notes.trim() || undefined,
      },
      {
        onSuccess: () => {
          setCaloriesOverride('');
          setNotes('');
        },
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteWorkoutMutation.mutate(id);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Log a Workout</Text>
              <Text style={styles.headerSub}>Calories you burn are added to today’s budget.</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={colors.textDim} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Workout Type Chips */}
            <Text style={styles.sectionLabel}>ACTIVITY TYPE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
              {WORKOUT_TYPES.map((type) => {
                const isSelected = selectedType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.chip, isSelected && styles.chipSelected]}
                    onPress={() => setSelectedType(type)}
                  >
                    <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>{type}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Duration Stepper */}
            <Text style={styles.sectionLabel}>DURATION (MINUTES)</Text>
            <View style={styles.stepperContainer}>
              {[15, 30, 45, 60, 90].map((d) => (
                <TouchableOpacity
                  key={d}
                  style={[styles.durationBtn, duration === d && styles.durationBtnSelected]}
                  onPress={() => setDuration(d)}
                >
                  <Text style={[styles.durationBtnText, duration === d && styles.durationBtnTextSelected]}>
                    {d}m
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Optional Calorie Override */}
            <View style={styles.inputRow}>
              <View style={styles.inputCol}>
                <Text style={styles.sectionLabel}>CALORIES BURNED (OPTIONAL)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  placeholder="Auto-estimated if empty"
                  placeholderTextColor={colors.textMute}
                  value={caloriesOverride}
                  onChangeText={setCaloriesOverride}
                />
              </View>
            </View>

            {/* Add Workout Button */}
            <TouchableOpacity
              style={styles.addBtn}
              onPress={handleLog}
              disabled={logWorkoutMutation.isPending}
            >
              {logWorkoutMutation.isPending ? (
                <ActivityIndicator color={colors.bg} size="small" />
              ) : (
                <>
                  <Plus size={18} color="#000" />
                  <Text style={styles.addBtnText}>Log Workout (+Bonus)</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Today's Logged Workouts */}
            <Text style={[styles.sectionLabel, { marginTop: spacing.xl }]}>TODAY'S LOGGED WORKOUTS</Text>
            {isLoadingWorkouts ? (
              <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} />
            ) : workoutsData?.workouts && workoutsData.workouts.length > 0 ? (
              workoutsData.workouts.map((w) => (
                <View key={w.id} style={styles.workoutItem}>
                  <View style={styles.workoutLeft}>
                    <View style={styles.workoutIcon}>
                      <Flame size={16} color={colors.accent} />
                    </View>
                    <View>
                      <Text style={styles.workoutType}>{w.type}</Text>
                      <View style={styles.workoutMeta}>
                        <Clock size={12} color={colors.textMute} />
                        <Text style={styles.workoutDuration}>{w.durationMin} mins</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.workoutRight}>
                    <Text style={styles.workoutKcal}>+{w.caloriesBurned} kcal</Text>
                    <TouchableOpacity
                      onPress={() => handleDelete(w.id)}
                      disabled={deleteWorkoutMutation.isPending}
                      style={styles.deleteBtn}
                    >
                      <Trash2 size={16} color={colors.loss} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No workouts logged for this day yet.</Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.card,
    borderTopLeftRadius: radii.card,
    borderTopRightRadius: radii.card,
    padding: spacing.xl,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  headerSub: {
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.cardAlt,
  },
  scrollContent: {
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  chipsScroll: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.cardAlt,
    marginRight: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDim,
  },
  chipTextSelected: {
    color: '#000',
    fontWeight: '700',
  },
  stepperContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.lg,
  },
  durationBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.button,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationBtnSelected: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  durationBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textDim,
  },
  durationBtnTextSelected: {
    color: colors.bg,
    fontWeight: '700',
  },
  inputRow: {
    marginBottom: spacing.lg,
  },
  inputCol: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.text,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: colors.profit,
    borderRadius: radii.button,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  workoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workoutIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  workoutType: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  workoutMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  workoutDuration: {
    fontSize: 12,
    color: colors.textMute,
  },
  workoutRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  workoutKcal: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.profit,
    fontVariant: ['tabular-nums'],
  },
  deleteBtn: {
    padding: 6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textMute,
    fontStyle: 'italic',
    marginVertical: 8,
  },
});


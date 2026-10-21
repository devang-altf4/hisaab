import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, radii, spacing, typography } from '../../src/theme/tokens';
import { api } from '../../src/api/client';
import { useMeal, usePatchMeal, useDeleteMeal, useEditMealItems } from '../../src/api/queries';
import { PnlBadge } from '../../src/components/PnlBadge';
import { ClarifyChips } from '../../src/components/ClarifyChips';
import { ItemEditor, previewRow, rowsFromIngredients, type ItemRow, type Preview } from '../../src/components/ItemEditor';
import { CorrectionSheet } from '../../src/components/CorrectionSheet';
import { X, Check, Trash2, Edit3, Plus, Minus, ArrowLeft, Quote, Sparkles, AlertCircle } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { MealType } from '../../src/api/hisaabApi';

export default function MealDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: mealData, isLoading, error } = useMeal(id!);
  const patchMealMutation = usePatchMeal();
  const editItemsMutation = useEditMealItems();
  const deleteMealMutation = useDeleteMeal();

  const meal = mealData?.meal;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [dishName, setDishName] = useState('');
  // Edit mode edits ITEMS; totals are always calculated from them (never typed).
  const [rows, setRows] = useState<ItemRow[]>([]);
  const [servings, setServings] = useState(1);
  const [mealType, setMealType] = useState<MealType>('lunch');

  useEffect(() => {
    if (meal) {
      setDishName(meal.dishName);
      setServings(meal.servings || 1);
      setMealType(meal.mealType);
    }
  }, [meal]);

  if (error && !meal) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={styles.dishName}>Meal not found</Text>
        <TouchableOpacity style={[styles.circleBtn, { marginTop: spacing.lg }]} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading || !meal) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} size="large" />
      </SafeAreaView>
    );
  }

  const imageUrl = api.resolveImageUrl(meal.imageUrl);

  const startEditing = () => {
    setDishName(meal.dishName);
    setMealType(meal.mealType);
    setRows(rowsFromIngredients(meal.ingredients));
    setIsEditing(true);
  };

  // Live preview of what the server will calculate (null rows = new/renamed, AI on save).
  const previews = rows.map((r) => previewRow(r, meal.ingredients));
  const pendingCount = isEditing ? previews.filter((p) => p === null).length : 0;
  const r1 = (n: number) => Math.round(n * 10) / 10;
  const shown = isEditing
    ? previews.reduce<Preview>(
        (t, p) =>
          p
            ? { calories: t.calories + p.calories, proteinG: r1(t.proteinG + p.proteinG), carbsG: r1(t.carbsG + p.carbsG), fatG: r1(t.fatG + p.fatG) }
            : t,
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      )
    : { calories: meal.calories, proteinG: meal.proteinG, carbsG: meal.carbsG, fatG: meal.fatG };

  const handleSaveItems = () => {
    const cleaned = rows.map((r) => ({ ...r, name: r.name.trim() }));
    if (!cleaned.length) {
      Alert.alert('Add at least one item', 'A meal needs at least one item. Use the trash icon to delete the meal.');
      return;
    }
    if (cleaned.some((r) => !r.name)) {
      Alert.alert('Name every item', 'Give each item a name, or remove the empty row.');
      return;
    }
    const bad = cleaned.find((r) => r.grams.trim() && !(parseFloat(r.grams) > 0));
    if (bad) {
      Alert.alert('Check the grams', `Enter a weight above 0 for ${bad.name}, or leave it empty.`);
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    editItemsMutation.mutate(
      {
        id: meal.id,
        items: cleaned.map((r) => ({
          ...(r.ref !== undefined ? { ref: r.ref } : {}),
          name: r.name,
          ...(r.grams.trim() ? { grams: parseFloat(r.grams) } : {}),
        })),
        ...(dishName.trim() && dishName.trim() !== meal.dishName ? { dishName: dishName.trim() } : {}),
        ...(mealType !== meal.mealType ? { mealType } : {}),
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
        onError: (err: any) => Alert.alert('Couldn’t save', err?.message || 'Try again.'),
      },
    );
  };

  const handleServingsChange = (newServings: number) => {
    const clamped = Math.max(0.5, Math.min(5, Math.round(newServings * 10) / 10));
    setServings(clamped);
    patchMealMutation.mutate({ id: meal.id, patch: { servings: clamped } });
  };

  const handleDelete = () => {
    Alert.alert('Delete Meal', 'Remove this meal from your log?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMealMutation.mutate(meal.id, {
            onSuccess: () => {
              router.back();
            },
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
          <ArrowLeft size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>{isEditing ? 'Fix Results' : 'Meal Details'}</Text>
        <TouchableOpacity style={styles.circleBtn} onPress={handleDelete}>
          <Trash2 size={18} color={colors.loss} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photo header if available */}
        {imageUrl && (
          <View style={styles.imageWrapper}>
            <Image source={{ uri: imageUrl }} style={styles.mealImage} resizeMode="cover" />
            {meal.hisaab && (
              <View style={styles.imagePnlBadge}>
                <PnlBadge pnl={meal.hisaab} size="md" />
              </View>
            )}
          </View>
        )}

        {/* P1: "How many skewers?" */}
        {!isEditing && meal.clarify ? <ClarifyChips meal={meal} variant="card" /> : null}

        {/* Dish Name & Meal Type */}
        <View style={styles.sectionCard}>
          {isEditing ? (
            <View>
              <Text style={styles.editLabel}>DISH NAME</Text>
              <TextInput
                style={styles.textInput}
                value={dishName}
                onChangeText={setDishName}
                placeholder="Dish name"
                placeholderTextColor={colors.textMute}
              />
            </View>
          ) : (
            <View style={styles.dishHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.dishName}>{meal.dishName}</Text>
                <Text style={styles.mealTypeBadge}>{meal.mealType.toUpperCase()}</Text>
              </View>
              {meal.edited && (
                <View style={styles.editedTag}>
                  <Text style={styles.editedTagText}>Edited</Text>
                </View>
              )}
            </View>
          )}

          {/* Servings Stepper (0.5x - 5x) — hidden while editing items */}
          {!isEditing && <View style={styles.servingsRow}>
            <Text style={styles.servingsLabel}>Portion Size:</Text>
            <View style={styles.stepperContainer}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleServingsChange(servings - 0.5)}
              >
                <Minus size={16} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.stepperVal}>{servings}x</Text>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleServingsChange(servings + 0.5)}
              >
                <Plus size={16} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>}

          {/* Meal Type Chips (when editing) */}
          {isEditing && (
            <View style={{ marginTop: spacing.md }}>
              <Text style={styles.editLabel}>MEAL SLOT</Text>
              <View style={styles.mealTypeRow}>
                {(['breakfast', 'lunch', 'snack', 'dinner'] as const).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, mealType === t && styles.typeChipActive]}
                    onPress={() => setMealType(t)}
                  >
                    <Text style={[styles.typeChipText, mealType === t && styles.typeChipTextActive]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Calories & macros: always the sum of the items (live preview while editing) */}
        <View style={styles.sectionCard}>
          <Text style={styles.sectionHeader}>CALORIES & MACROS</Text>
          <View style={styles.calorieRow}>
            <View style={styles.calDisplay}>
              <Text style={styles.calNumber}>{shown.calories}</Text>
              <Text style={styles.calUnit}>kcal</Text>
            </View>
          </View>
          {pendingCount > 0 ? (
            <Text style={styles.previewNote}>
              + {pendingCount} item{pendingCount > 1 ? 's' : ''} the AI will calculate when you save
            </Text>
          ) : null}

          <View style={styles.macroTilesRow}>
            <View style={[styles.macroTile, { borderColor: 'rgba(248, 113, 113, 0.4)' }]}>
              <Text style={[styles.macroTileLabel, { color: colors.protein }]}>Protein</Text>
              <Text style={styles.macroTileVal}>{shown.proteinG}g</Text>
            </View>
            <View style={[styles.macroTile, { borderColor: 'rgba(251, 191, 36, 0.4)' }]}>
              <Text style={[styles.macroTileLabel, { color: colors.carbs }]}>Carbs</Text>
              <Text style={styles.macroTileVal}>{shown.carbsG}g</Text>
            </View>
            <View style={[styles.macroTile, { borderColor: 'rgba(96, 165, 250, 0.4)' }]}>
              <Text style={[styles.macroTileLabel, { color: colors.fat }]}>Fat</Text>
              <Text style={styles.macroTileVal}>{shown.fatG}g</Text>
            </View>
          </View>
        </View>

        {/* Health Score Bar */}
        <View style={styles.sectionCard}>
          <View style={styles.healthScoreHeader}>
            <Text style={styles.sectionHeader}>HEALTH SCORE</Text>
            <Text style={styles.healthScoreNumber}>{meal.healthScore || 5}/10</Text>
          </View>
          <View style={styles.healthBarTrack}>
            <View
              style={[
                styles.healthBarFill,
                {
                  width: `${((meal.healthScore || 5) / 10) * 100}%`,
                  backgroundColor: (meal.healthScore || 5) >= 7 ? colors.profit : (meal.healthScore || 5) >= 5 ? colors.accent : colors.loss,
                },
              ]}
            />
          </View>
        </View>

        {/* Coach's verdict */}
        {meal.verdict ? (
          <View style={styles.verdictBubble}>
            <View style={styles.quoteIconRow}>
              <Quote size={18} color={colors.accent} />
              <Text style={styles.verdictTitle}>Coach’s take</Text>
            </View>
            <Text style={styles.verdictText}>"{meal.verdict}"</Text>
          </View>
        ) : null}

        {/* Items: editable in edit mode, read-only otherwise */}
        {isEditing ? (
          <ItemEditor rows={rows} original={meal.ingredients} onChange={setRows} />
        ) : meal.ingredients && meal.ingredients.length > 0 && (
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader}>ESTIMATED INGREDIENTS</Text>
            {meal.ingredients.map((ing, idx) => (
              <View key={idx} style={styles.ingredientRow}>
                <View style={styles.ingLeft}>
                  <Text style={styles.ingName}>{ing.name}</Text>
                  {ing.quantity || ing.grams ? (
                    <Text style={styles.ingQty}>
                      {[ing.quantity, ing.grams && ing.quantity !== `${ing.grams} g` ? `${ing.grams} g` : null].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.ingKcal}>{ing.calories} kcal</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Action Buttons */}
      <View style={styles.bottomBar}>
        {isEditing ? (
          <View style={styles.editActionsRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveItems}
              disabled={editItemsMutation.isPending}
            >
              {editItemsMutation.isPending ? (
                <ActivityIndicator color="#000" size="small" />
              ) : (
                <>
                  <Check size={18} color="#000" />
                  <Text style={styles.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.editActionsRow}>
            <TouchableOpacity
              style={styles.fixResultsBtn}
              onPress={() => setCorrecting(true)}
              accessibilityHint="Tell the AI what the meal really is and recalculate"
            >
              <AlertCircle size={18} color={colors.accent} />
              <Text style={styles.fixResultsBtnText}>Wrong?</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.fixResultsBtn} onPress={startEditing}>
              <Edit3 size={18} color={colors.text} />
              <Text style={styles.fixResultsBtnText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <CorrectionSheet
        visible={correcting}
        meal={meal}
        onClose={() => setCorrecting(false)}
        onEditNumbers={startEditing}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  screenTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  circleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: 120,
    gap: spacing.lg,
  },
  imageWrapper: {
    height: 240,
    borderRadius: radii.card,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mealImage: {
    width: '100%',
    height: '100%',
  },
  imagePnlBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginBottom: spacing.md,
  },
  dishHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  dishName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  mealTypeBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accent,
    marginTop: 4,
  },
  editedTag: {
    backgroundColor: colors.cardAlt,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.pill,
  },
  editedTagText: {
    fontSize: 11,
    color: colors.textMute,
    fontWeight: '600',
  },
  servingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  servingsLabel: {
    fontSize: 14,
    color: colors.textDim,
    fontWeight: '600',
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
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  editLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMute,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 16,
  },
  mealTypeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.button,
    backgroundColor: colors.cardAlt,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  typeChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMute,
  },
  typeChipTextActive: {
    color: colors.accent,
  },
  calorieRow: {
    marginBottom: spacing.md,
  },
  calDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  calNumber: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  calUnit: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textDim,
  },
  previewNote: { fontSize: 13, color: colors.accent, marginTop: -4, marginBottom: 8 },
  macroTilesRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  macroTile: {
    flex: 1,
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: 'center',
  },
  macroTileLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  macroTileVal: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  macroTileInput: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: 2,
    textAlign: 'center',
    width: '100%',
  },
  healthScoreHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  healthScoreNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  healthBarTrack: {
    height: 6,
    backgroundColor: colors.cardAlt,
    borderRadius: 3,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  verdictBubble: {
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    padding: spacing.lg,
    gap: 8,
  },
  quoteIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  verdictTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
  },
  verdictText: {
    fontSize: 15,
    fontStyle: 'italic',
    color: colors.text,
    lineHeight: 22,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  ingLeft: {},
  ingName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  ingQty: {
    fontSize: 12,
    color: colors.textMute,
    marginTop: 2,
  },
  ingKcal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.xl,
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textDim,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.profit,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000',
  },
  fixResultsBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  fixResultsBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  doneBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radii.button,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.bg,
  },
});


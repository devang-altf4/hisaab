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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { colors, radii } from '../../src/theme/tokens';
import { font } from '../../src/theme/fonts';
import { api } from '../../src/api/client';
import { useMeal, usePatchMeal, useDeleteMeal, useEditMealItems } from '../../src/api/queries';
import { ClarifyChips } from '../../src/components/ClarifyChips';
import { useAuth } from '../../src/auth/AuthContext';
import { ItemEditor, previewRow, rowsFromIngredients, type ItemRow, type Preview } from '../../src/components/ItemEditor';
import { CorrectionSheet } from '../../src/components/CorrectionSheet';
import { ChevronLeft, Trash2, Plus, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { MealType } from '../../src/api/hisaabApi';

const MEAL_SLOTS: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export default function MealDetailScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const goal = useAuth().user?.profile?.goal;
  const { data: mealData, isLoading, error } = useMeal(id!);
  const patchMealMutation = usePatchMeal();
  const editItemsMutation = useEditMealItems();
  const deleteMealMutation = useDeleteMeal();

  const meal = mealData?.meal;

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [dishName, setDishName] = useState('');
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
        <Text style={styles.errorText}>Meal not found</Text>
        <TouchableOpacity style={styles.circleBtn} onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.text} />
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isLoading || !meal) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator color={colors.textDim} size="large" />
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

  // Live preview of what the server will calculate
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
      Alert.alert('Add at least one item', 'A meal needs at least one item.');
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

  const timeFormatted = meal.loggedAt
    ? new Date(meal.loggedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const mealTypeFormatted = meal.mealType
    ? meal.mealType.charAt(0).toUpperCase() + meal.mealType.slice(1)
    : '';
  const subline = [mealTypeFormatted, timeFormatted].filter(Boolean).join(', ');

  // P&L vs this meal's share of the daily budget (not the whole day)
  let profitLine: string | null = null;
  let profitColor: string = colors.textDim;
  if (meal.hisaab) {
    const slot = meal.mealType || 'this meal';
    const kcalAmt = Math.abs(meal.hisaab.amount);
    if (meal.hisaab.status === 'PROFIT') {
      profitLine = `In profit for ${slot} by ${kcalAmt} kcal`;
      profitColor = colors.profit;
    } else if (meal.hisaab.status === 'LOSS') {
      // Gain goal: a small meal isn't a loss, it's room to eat more
      profitLine = goal === 'gain' ? `Need ${kcalAmt} kcal more at ${slot}` : `In loss for ${slot} by ${kcalAmt} kcal`;
      profitColor = colors.loss;
    } else {
      profitLine = `Right on budget for ${slot}`;
    }
  }
  const healthScore = meal.healthScore > 0 ? Math.min(10, meal.healthScore) : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Nav Bar */}
      <View style={styles.navBar}>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <ChevronLeft size={28} color={colors.text} strokeWidth={2.4} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Meal</Text>
        <TouchableOpacity
          style={styles.navBtn}
          onPress={handleDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete meal"
        >
          <Trash2 size={20} color={colors.loss} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Photo at top, 4:3 ratio, 20 pt corners */}
        {imageUrl && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUrl }} style={styles.photo} resizeMode="cover" />
          </View>
        )}

        {/* Meal Name & Subline */}
        <View style={styles.titleSection}>
          {isEditing ? (
            <>
              <TextInput
                style={styles.editTitleInput}
                value={dishName}
                onChangeText={setDishName}
                placeholder="Dish name"
                placeholderTextColor={colors.textMute}
                selectionColor="#FFFFFF"
              />
              <View style={styles.slotRow} accessibilityRole="radiogroup">
                {MEAL_SLOTS.map((t) => {
                  const on = mealType === t;
                  return (
                    <TouchableOpacity
                      key={t}
                      style={[styles.slotChip, on && styles.slotChipOn]}
                      onPress={() => setMealType(t)}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                    >
                      <Text style={[styles.slotChipText, on && styles.slotChipTextOn]}>
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.dishName}>{meal.dishName}</Text>
              <Text style={styles.subline}>{subline}</Text>
            </>
          )}
        </View>

        {/* Big kcal + profit line */}
        <View style={styles.caloriesSection}>
          <Text style={styles.bigKcal}>{shown.calories} kcal</Text>
          {profitLine && !isEditing && (
            <Text style={[styles.profitLine, { color: profitColor }]}>
              {profitLine}
            </Text>
          )}
          {isEditing && (
            <Text style={styles.previewNote}>Totals are calculated from the items</Text>
          )}
          {pendingCount > 0 && (
            <Text style={styles.pendingNote}>
              + {pendingCount} item{pendingCount > 1 ? 's' : ''} the AI will calculate when you save
            </Text>
          )}
        </View>

        {/* Three Macro Tiles: Protein, Carbs, Fat */}
        <View style={styles.macroTilesRow}>
          <View style={styles.macroTile}>
            <Text style={styles.macroTileLabel}>Protein</Text>
            <Text style={[styles.macroTileValue, { color: colors.protein }]}>{shown.proteinG} g</Text>
          </View>
          <View style={styles.macroTile}>
            <Text style={styles.macroTileLabel}>Carbs</Text>
            <Text style={[styles.macroTileValue, { color: colors.carbs }]}>{shown.carbsG} g</Text>
          </View>
          <View style={styles.macroTile}>
            <Text style={styles.macroTileLabel}>Fat</Text>
            <Text style={[styles.macroTileValue, { color: colors.fat }]}>{shown.fatG} g</Text>
          </View>
        </View>

        {/* QUESTION CARD (shows when meal.clarify is present) */}
        {!isEditing && meal.clarify ? (
          <ClarifyChips meal={meal} variant="card" />
        ) : null}

        {/* Items: edit mode or read-only list */}
        {isEditing ? (
          <ItemEditor rows={rows} original={meal.ingredients} onChange={setRows} />
        ) : (
          <View style={styles.sectionWrap}>
            <Text style={styles.sectionHeader}>What’s in it</Text>
            <View style={styles.groupedList}>
              {meal.ingredients.map((item, idx) => (
                <View key={idx} style={styles.ingredientRowWrap}>
                  <View style={styles.ingredientRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.ingredientName}>{item.name}</Text>
                      {item.quantity || item.grams ? (
                        <Text style={styles.ingredientDetail}>
                          {[item.quantity, item.grams && item.quantity !== `${item.grams} g` ? `${item.grams} g` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={styles.ingredientKcal}>{item.calories} kcal</Text>
                  </View>
                  {idx < meal.ingredients.length - 1 && <View style={styles.separator} />}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Portion stepper (hidden during editing) */}
        {!isEditing && (
          <View style={styles.portionRow}>
            <Text style={styles.portionLabel}>Portion {servings}×</Text>
            <View style={styles.stepperWrap}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleServingsChange(servings - 0.5)}
                accessibilityLabel="Decrease portion"
              >
                <Minus size={18} color={colors.text} strokeWidth={2.4} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleServingsChange(servings + 0.5)}
                accessibilityLabel="Increase portion"
              >
                <Plus size={18} color={colors.text} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Health Score + Coach's verdict */}
        {!isEditing && (healthScore !== null || meal.verdict) && (
          <View style={styles.healthSection}>
            {healthScore !== null && (
              <>
                <View style={styles.healthScoreRow}>
                  <Text style={styles.healthScoreLabel}>Health score</Text>
                  <Text style={styles.healthScoreValue}>{healthScore} of 10</Text>
                </View>
                <View style={styles.healthBarTrack}>
                  <View
                    style={[
                      styles.healthBarFill,
                      {
                        width: `${(healthScore / 10) * 100}%`,
                        backgroundColor:
                          healthScore >= 7 ? colors.profit : healthScore >= 4 ? colors.accent : colors.loss,
                      },
                    ]}
                  />
                </View>
              </>
            )}
            {meal.verdict ? (
              <Text style={styles.verdictText}>Coach’s take: {meal.verdict}</Text>
            ) : null}
          </View>
        )}
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        {isEditing ? (
          <View style={styles.editingActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditing(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSaveItems}
              disabled={editItemsMutation.isPending}
            >
              {editItemsMutation.isPending ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.normalActions}>
            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => router.back()}
              accessibilityRole="button"
            >
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                onPress={() => setCorrecting(true)}
                style={styles.secTextBtn}
                accessibilityRole="button"
              >
                <Text style={styles.secTextBtnText}>Wrong?</Text>
              </TouchableOpacity>
              <Text style={styles.secDot}>·</Text>
              <TouchableOpacity
                onPress={startEditing}
                style={styles.secTextBtn}
                accessibilityRole="button"
              >
                <Text style={styles.secTextBtnText}>Edit items</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Correction Sheet */}
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
    gap: 16,
  },
  errorText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: colors.text,
  },
  circleBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 52,
  },
  navBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: colors.text,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 140,
    gap: 18,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.card,
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  titleSection: {
    gap: 4,
  },
  dishName: {
    fontFamily: font.bold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
    color: colors.text,
  },
  subline: {
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.textDim,
    letterSpacing: -0.2,
  },
  editTitleInput: {
    backgroundColor: colors.card,
    borderRadius: radii.input,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: font.semibold,
    fontSize: 20,
    color: colors.text,
  },
  slotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  slotChip: {
    flex: 1,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipOn: {
    backgroundColor: '#FFFFFF',
  },
  slotChipText: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.textDim,
  },
  slotChipTextOn: {
    color: '#000000',
  },
  caloriesSection: {
    gap: 4,
  },
  bigKcal: {
    fontFamily: font.bold,
    fontSize: 38,
    letterSpacing: -1,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  profitLine: {
    fontFamily: font.medium,
    fontSize: 15,
    letterSpacing: -0.2,
  },
  previewNote: {
    fontFamily: font.regular,
    fontSize: 14,
    color: colors.textDim,
  },
  pendingNote: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.accent,
  },
  macroTilesRow: {
    flexDirection: 'row',
    gap: 12,
  },
  macroTile: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 14,
    gap: 4,
  },
  macroTileLabel: {
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textDim,
  },
  macroTileValue: {
    fontFamily: font.semibold,
    fontSize: 18,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  sectionWrap: {
    gap: 10,
    marginTop: 4,
  },
  sectionHeader: {
    fontFamily: font.semibold,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.4,
  },
  groupedList: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  ingredientRowWrap: {
    position: 'relative',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  ingredientName: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
  ingredientDetail: {
    fontFamily: font.regular,
    fontSize: 13,
    color: colors.textDim,
    marginTop: 2,
  },
  ingredientKcal: {
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  separator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  portionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  portionLabel: {
    fontFamily: font.semibold,
    fontSize: 16,
    color: colors.text,
  },
  stepperWrap: {
    flexDirection: 'row',
    gap: 8,
  },
  stepperBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  healthSection: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    padding: 16,
    gap: 10,
  },
  healthScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthScoreLabel: {
    fontFamily: font.medium,
    fontSize: 15,
    color: colors.textDim,
  },
  healthScoreValue: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  healthBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.control,
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  verdictText: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDim,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 12,
    paddingHorizontal: 24,
  },
  normalActions: {
    gap: 10,
    alignItems: 'center',
  },
  doneBtn: {
    width: '100%',
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: '#000000',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secTextBtn: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  secTextBtnText: {
    fontFamily: font.medium,
    fontSize: 16,
    color: colors.textDim,
  },
  secDot: {
    color: colors.textMute,
  },
  editingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontFamily: font.semibold,
    fontSize: 17,
    color: colors.textDim,
  },
  saveBtn: {
    flex: 1,
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

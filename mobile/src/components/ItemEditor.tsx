import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { colors, radii } from '../theme/tokens';
import { font } from '../theme/fonts';
import type { Ingredient } from '../api/hisaabApi';

/** One editable row. `ref` = index of the original item (absent for an added item). */
export interface ItemRow {
  key: string;
  ref?: number;
  name: string;
  /** Text in the grams field ('' = keep the original amount). */
  grams: string;
}

export interface Preview {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

let seq = 0;
export const newRowKey = () => `row-${Date.now()}-${seq++}`;

export function rowsFromIngredients(items: Ingredient[]): ItemRow[] {
  return items.map((i, idx) => ({ key: newRowKey(), ref: idx, name: i.name, grams: i.grams ? String(i.grams) : '' }));
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What the server will do with this row, so the screen can show live totals:
 * same item + new grams → exact rescale; same item untouched → unchanged;
 * new or renamed → null (the AI calculates it on save).
 */
export function previewRow(row: ItemRow, original: Ingredient[]): Preview | null {
  const orig = row.ref !== undefined ? original[row.ref] : undefined;
  if (!orig || !same(orig.name, row.name)) return null;
  const g = parseFloat(row.grams);
  const pick = (f: number): Preview => ({
    calories: Math.round(orig.calories * f),
    proteinG: Math.round((orig.proteinG ?? 0) * f * 10) / 10,
    carbsG: Math.round((orig.carbsG ?? 0) * f * 10) / 10,
    fatG: Math.round((orig.fatG ?? 0) * f * 10) / 10,
  });
  if (!row.grams.trim() || (orig.grams && g === orig.grams)) return pick(1);
  if (orig.grams && g > 0) return pick(g / orig.grams);
  return null; // weight added to an item that never had one → AI estimates it
}

interface ItemEditorProps {
  rows: ItemRow[];
  original: Ingredient[];
  onChange: (rows: ItemRow[]) => void;
}

export const ItemEditor: React.FC<ItemEditorProps> = ({ rows, original, onChange }) => {
  const update = (key: string, patch: Partial<ItemRow>) =>
    onChange(rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const remove = (key: string) => onChange(rows.filter((r) => r.key !== key));
  const add = () => onChange([...rows, { key: newRowKey(), name: '', grams: '' }]);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>What’s in it</Text>
      <Text style={styles.help}>
        Change the grams, remove items, or add new ones. Totals are calculated from these items.
      </Text>

      <View style={styles.group}>
        {rows.map((row, idx) => {
          const p = previewRow(row, original);
          return (
            <View key={row.key} style={styles.rowWrapper}>
              <View style={styles.row}>
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  value={row.name}
                  onChangeText={(name) => update(row.key, { name })}
                  placeholder="Item name"
                  placeholderTextColor={colors.textMute}
                  maxLength={60}
                  accessibilityLabel="Item name"
                  selectionColor="#FFFFFF"
                />
                <View style={styles.gramsWrap}>
                  <TextInput
                    style={[styles.input, styles.gramsInput]}
                    value={row.grams}
                    onChangeText={(g) => update(row.key, { grams: g.replace(/[^0-9.]/g, '') })}
                    placeholder="—"
                    placeholderTextColor={colors.textMute}
                    keyboardType="numeric"
                    maxLength={5}
                    accessibilityLabel={`${row.name || 'Item'} weight in grams`}
                    selectionColor="#FFFFFF"
                  />
                  <Text style={styles.unit}>g</Text>
                </View>
                <Text style={[styles.kcal, !p && styles.kcalPending]} numberOfLines={1}>
                  {p ? `${p.calories} kcal` : 'AI on save'}
                </Text>
                <Pressable
                  onPress={() => remove(row.key)}
                  hitSlop={8}
                  style={styles.remove}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${row.name || 'item'}`}
                >
                  <X size={18} color={colors.textDim} />
                </Pressable>
              </View>
              {idx < rows.length - 1 && <View style={styles.separator} />}
            </View>
          );
        })}
      </View>

      <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" disabled={rows.length >= 25}>
        <Plus size={18} color={colors.text} />
        <Text style={styles.addText}>Add item</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 20,
    gap: 8,
  },
  sectionTitle: {
    fontFamily: font.semibold,
    fontSize: 20,
    color: colors.text,
    letterSpacing: -0.4,
  },
  help: {
    fontFamily: font.regular,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textDim,
    marginBottom: 6,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    overflow: 'hidden',
  },
  rowWrapper: {
    position: 'relative',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 10,
  },
  input: {
    backgroundColor: colors.control,
    borderRadius: radii.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: font.regular,
    fontSize: 15,
    color: colors.text,
  },
  nameInput: { flex: 1 },
  gramsWrap: { flexDirection: 'row', alignItems: 'center' },
  gramsInput: {
    width: 60,
    textAlign: 'right',
    paddingRight: 6,
    fontVariant: ['tabular-nums'],
  },
  unit: {
    position: 'absolute',
    right: 8,
    fontFamily: font.medium,
    fontSize: 13,
    color: colors.textMute,
  },
  kcal: {
    width: 74,
    fontFamily: font.medium,
    fontSize: 14,
    color: colors.text,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  kcalPending: {
    color: colors.accent,
    fontFamily: font.medium,
    fontSize: 12,
  },
  remove: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  separator: {
    position: 'absolute',
    left: 16,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    alignSelf: 'flex-start',
  },
  addText: {
    fontFamily: font.semibold,
    fontSize: 15,
    color: colors.text,
    letterSpacing: -0.2,
  },
});

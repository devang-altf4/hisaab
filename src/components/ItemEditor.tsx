import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus, X } from 'lucide-react-native';
import { colors, radii, spacing } from '../theme/tokens';
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
    <View style={styles.card}>
      <Text style={styles.header}>WHAT’S IN IT</Text>
      <Text style={styles.help}>
        Change the grams, remove what you didn’t eat, or add what’s missing. Totals are calculated from these items.
      </Text>

      {rows.map((row) => {
        const p = previewRow(row, original);
        return (
          <View key={row.key} style={styles.row}>
            <TextInput
              style={[styles.input, styles.nameInput]}
              value={row.name}
              onChangeText={(name) => update(row.key, { name })}
              placeholder="Item, e.g. Raita"
              placeholderTextColor={colors.textMute}
              maxLength={60}
              accessibilityLabel="Item name"
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
              />
              <Text style={styles.unit}>g</Text>
            </View>
            <Text style={[styles.kcal, !p && styles.kcalPending]} numberOfLines={2}>
              {p ? `${p.calories} kcal` : 'AI on save'}
            </Text>
            <Pressable
              onPress={() => remove(row.key)}
              hitSlop={8}
              style={styles.remove}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${row.name || 'item'}`}
            >
              <X size={16} color={colors.textDim} />
            </Pressable>
          </View>
        );
      })}

      <Pressable onPress={add} style={styles.addBtn} accessibilityRole="button" disabled={rows.length >= 25}>
        <Plus size={16} color={colors.accent} />
        <Text style={styles.addText}>Add item</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: 10,
  },
  header: { fontSize: 12, fontWeight: '800', color: colors.textMute, letterSpacing: 1 },
  help: { fontSize: 13, lineHeight: 18, color: colors.textDim, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    backgroundColor: colors.cardAlt,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 15,
    color: colors.text,
  },
  nameInput: { flex: 1, minWidth: 0 },
  gramsWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  gramsInput: { width: 62, textAlign: 'right', fontVariant: ['tabular-nums'] },
  unit: { fontSize: 13, color: colors.textDim },
  kcal: { width: 64, textAlign: 'right', fontSize: 13, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  kcalPending: { color: colors.accent, fontWeight: '600', fontSize: 12 },
  remove: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cardAlt },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, alignSelf: 'flex-start' },
  addText: { fontSize: 15, fontWeight: '700', color: colors.accent },
});

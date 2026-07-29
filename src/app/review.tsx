import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { searchProducts } from '@/api/openfoodfacts';
import type { ReviewItem } from '@/api/vision';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  addToPantryItem,
  findSimilarItem,
  formatQuantity,
  insertPantryItem,
  PANTRY_UNITS,
  PantryItem,
  PantryUnit,
  updatePantryItem,
} from '@/db/pantry';
import { useTheme } from '@/hooks/use-theme';
import { takeImportDraft } from '@/state/import-draft';

type EditableItem = {
  name: string;
  brand: string;
  quantity: string;
  unit: PantryUnit;
};

/** Pantry item each row will top up, keyed by row index. */
type Duplicates = Record<number, PantryItem>;

export default function ReviewScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const [items, setItems] = useState<EditableItem[]>(() =>
    takeImportDraft().map((item: ReviewItem) => ({
      name: item.name,
      brand: item.brand ?? '',
      quantity: String(item.quantity),
      unit: item.unit,
    }))
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [duplicates, setDuplicates] = useState<Duplicates>({});

  // Flag rows that will top up something already in the pantry, so merging
  // is visible before you commit rather than a surprise afterwards.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: Duplicates = {};
      for (const [index, item] of items.entries()) {
        if (!item.name.trim()) continue;
        const existing = await findSimilarItem(db, item.name, item.unit);
        if (existing) found[index] = existing;
      }
      if (!cancelled) setDuplicates(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [db, items]);

  const update = (index: number, patch: Partial<EditableItem>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const remove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const confirm = async () => {
    setError('');
    for (const item of items) {
      if (!item.name.trim()) {
        setError('Every item needs a name (or remove the empty row).');
        return;
      }
      const q = Number(item.quantity.replace(',', '.'));
      if (Number.isNaN(q) || q < 0) {
        setError(`“${item.name}” has an invalid quantity.`);
        return;
      }
    }
    setSaving(true);
    try {
      const inserted: { id: number; name: string; brand: string }[] = [];
      for (const item of items) {
        const amount = Number(item.quantity.replace(',', '.'));
        // Buying something again tops up what's there rather than adding a
        // second card for the same food.
        const existing = await findSimilarItem(db, item.name, item.unit);
        if (existing) {
          await addToPantryItem(db, existing.id, amount);
          if (!existing.photo_url) {
            inserted.push({ id: existing.id, name: existing.name, brand: existing.brand ?? '' });
          }
          continue;
        }
        const id = await insertPantryItem(db, {
          name: item.name,
          brand: item.brand || null,
          quantity: amount,
          unit: item.unit,
        });
        inserted.push({ id, name: item.name, brand: item.brand });
      }
      // Enrich before leaving. Firing this off as the screen unmounted meant
      // failures were invisible and photos arrived (or didn't) unannounced.
      await enrichItems(inserted);
      if (router.canGoBack()) router.back();
      else router.replace('/');
    } finally {
      setSaving(false);
      setProgress('');
    }
  };

  /** Photo and nutrition lookup. A miss on one item never blocks the rest. */
  const enrichItems = async (rows: { id: number; name: string; brand: string }[]) => {
    for (const [index, row] of rows.entries()) {
      setProgress(`Finding photos… ${index + 1} of ${rows.length}`);
      try {
        const results = await searchProducts(row.name, row.brand);
        const match = results.find((r) => r.imageUrl) ?? results.find((r) => r.nutrition);
        if (!match) continue;
        const current = await db.getFirstAsync<{
          name: string;
          brand: string | null;
          quantity: number;
          unit: PantryUnit;
          category: string | null;
        }>('SELECT name, brand, quantity, unit, category FROM pantry_items WHERE id = ?', row.id);
        if (!current) continue;
        await updatePantryItem(db, row.id, {
          ...current,
          photo_url: match.imageUrl,
          off_id: match.code,
          nutrition: match.nutrition,
        });
      } catch {
        // Enrichment is a bonus; the item is already saved either way.
      }
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.background, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Review items' }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ThemedText themeColor="textSecondary">
          Check what the AI found. Fix anything that looks wrong — nothing is saved until you
          confirm.
        </ThemedText>

        {items.length === 0 && (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing to review. Go to Import and parse a screenshot first.
          </ThemedText>
        )}

        {items.map((item, index) => (
          <ThemedView key={index} type="backgroundElement" style={styles.card}>
            <TextInput
              value={item.name}
              onChangeText={(name) => update(index, { name })}
              placeholder="Item name"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            <TextInput
              value={item.brand}
              onChangeText={(brand) => update(index, { brand })}
              placeholder="Brand (optional)"
              placeholderTextColor={theme.textSecondary}
              style={inputStyle}
            />
            <ThemedView type="backgroundElement" style={styles.quantityRow}>
              <TextInput
                value={item.quantity}
                onChangeText={(quantity) => update(index, { quantity })}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={theme.textSecondary}
                style={[...inputStyle, styles.quantityInput]}
              />
              {PANTRY_UNITS.map((u) => (
                <Pressable key={u} onPress={() => update(index, { unit: u })}>
                  <ThemedView
                    type={item.unit === u ? 'backgroundSelected' : 'background'}
                    style={styles.unitPill}>
                    <ThemedText type={item.unit === u ? 'smallBold' : 'small'}>{u}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
            {duplicates[index] && (
              <ThemedText type="small" style={[styles.mergeNote, { color: theme.warn }]}>
                Tops up “{duplicates[index].name}” — already have{' '}
                {formatQuantity(duplicates[index].quantity, duplicates[index].unit)}
              </ThemedText>
            )}
            <Pressable onPress={() => remove(index)}>
              <ThemedText type="small" style={[styles.removeText, { color: theme.danger }]}>
                Remove
              </ThemedText>
            </Pressable>
          </ThemedView>
        ))}

        {error ? (
          <ThemedText type="smallBold" style={[styles.removeText, { color: theme.danger }]}>
            {error}
          </ThemedText>
        ) : null}

        {items.length > 0 && (
          <Pressable onPress={confirm} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.confirmButton}>
              <ThemedText type="smallBold">
                {saving
                  ? progress || 'Saving…'
                  : `Add ${items.length} item${items.length === 1 ? '' : 's'} to pantry`}
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    gap: 12,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  input: {
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  quantityInput: {
    flexGrow: 1,
    flexBasis: 100,
  },
  unitPill: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  mergeNote: {
  },
  removeText: {
    textAlign: 'center',
    paddingVertical: 2,
  },
  confirmButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});

import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { searchProducts } from '@/api/openfoodfacts';
import type { ReviewItem } from '@/api/vision';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { insertPantryItem, PANTRY_UNITS, PantryUnit, updatePantryItem } from '@/db/pantry';
import { useTheme } from '@/hooks/use-theme';
import { takeImportDraft } from '@/state/import-draft';

type EditableItem = {
  name: string;
  brand: string;
  quantity: string;
  unit: PantryUnit;
};

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
        const id = await insertPantryItem(db, {
          name: item.name,
          brand: item.brand || null,
          quantity: Number(item.quantity.replace(',', '.')),
          unit: item.unit,
        });
        inserted.push({ id, name: item.name, brand: item.brand });
      }
      void enrichInBackground(inserted);
      router.back();
    } finally {
      setSaving(false);
    }
  };

  /** Best-effort photo enrichment after save; failures are silent by design. */
  const enrichInBackground = async (rows: { id: number; name: string; brand: string }[]) => {
    for (const row of rows) {
      try {
        const results = await searchProducts(`${row.name} ${row.brand}`.trim());
        const match = results.find((r) => r.imageUrl);
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
        });
      } catch {
        // enrichment is a bonus, not a blocker
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
            <Pressable onPress={() => remove(index)}>
              <ThemedText type="small" style={styles.removeText}>
                Remove
              </ThemedText>
            </Pressable>
          </ThemedView>
        ))}

        {error ? (
          <ThemedText type="smallBold" style={styles.removeText}>
            {error}
          </ThemedText>
        ) : null}

        {items.length > 0 && (
          <Pressable onPress={confirm} disabled={saving}>
            <ThemedView type="backgroundSelected" style={styles.confirmButton}>
              <ThemedText type="smallBold">
                {saving
                  ? 'Saving…'
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
  removeText: {
    color: '#e5484d',
    textAlign: 'center',
    paddingVertical: 2,
  },
  confirmButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});

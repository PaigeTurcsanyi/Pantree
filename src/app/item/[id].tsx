import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Nutrition, OffProduct, searchProducts } from '@/api/openfoodfacts';
import { ConfirmPanel } from '@/components/confirm-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  deletePantryItem,
  formatQuantity,
  getPantryItem,
  insertPantryItem,
  PANTRY_UNITS,
  PantryUnit,
  parseNutrition,
  updatePantryItem,
} from '@/db/pantry';
import { useTheme } from '@/hooks/use-theme';

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const itemId = isNew ? null : Number(id);

  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();

  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<PantryUnit>('g');
  const [category, setCategory] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [offId, setOffId] = useState<string | null>(null);
  const [nutrition, setNutrition] = useState<Nutrition | null>(null);
  const [error, setError] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<OffProduct[] | null>(null);
  const [searchError, setSearchError] = useState('');

  useEffect(() => {
    if (itemId === null) return;
    getPantryItem(db, itemId).then((item) => {
      if (!item) return;
      setName(item.name);
      setBrand(item.brand ?? '');
      setQuantity(String(item.quantity));
      setUnit(item.unit);
      setCategory(item.category ?? '');
      setPhotoUrl(item.photo_url);
      setOffId(item.off_id);
      setNutrition(parseNutrition(item.nutrition));
    });
  }, [db, itemId]);

  const save = async () => {
    const parsedQuantity = Number(quantity.replace(',', '.'));
    if (!name.trim()) {
      setError('Give the item a name.');
      return;
    }
    if (!quantity.trim() || Number.isNaN(parsedQuantity) || parsedQuantity < 0) {
      setError('Enter a quantity of 0 or more.');
      return;
    }
    const input = {
      name,
      brand,
      quantity: parsedQuantity,
      unit,
      category,
      photo_url: photoUrl,
      off_id: offId,
      nutrition,
    };
    if (itemId === null) {
      await insertPantryItem(db, input);
    } else {
      await updatePantryItem(db, itemId, input);
    }
    leaveScreen();
  };

  const doDelete = async () => {
    if (itemId === null) return;
    await deletePantryItem(db, itemId);
    leaveScreen();
  };

  /** Opened directly by URL there may be nothing to go back to. */
  const leaveScreen = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const findProduct = async () => {
    if (!name.trim()) {
      setError('Enter a name first, then search.');
      return;
    }
    setError('');
    setSearchError('');
    setSearching(true);
    setResults(null);
    try {
      const found = await searchProducts(name, brand);
      setResults(found);
      if (found.length === 0) {
        setSearchError('No matches found. The item saves fine without a photo.');
      }
    } catch {
      setSearchError('Couldn’t reach Open Food Facts. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const applyProduct = (product: OffProduct) => {
    setPhotoUrl(product.imageUrl);
    setOffId(product.code);
    setNutrition(product.nutrition);
    if (!brand.trim() && product.brand) setBrand(product.brand);
    if (product.packageQuantity && product.packageUnit && !Number(quantity.replace(',', '.'))) {
      setQuantity(String(product.packageQuantity));
      setUnit(product.packageUnit);
    }
    setResults(null);
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: isNew ? 'Add item' : 'Edit item' }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <ThemedText type="smallBold" themeColor="textSecondary">
          Name
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Flour"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="smallBold" themeColor="textSecondary">
          Brand (optional)
        </ThemedText>
        <TextInput
          value={brand}
          onChangeText={setBrand}
          placeholder="No Name"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedView style={styles.photoRow}>
          {photoUrl ? (
            <>
              <Image source={photoUrl} style={styles.photo} contentFit="contain" transition={150} />
              <Pressable onPress={() => { setPhotoUrl(null); setOffId(null); }}>
                <ThemedView type="backgroundElement" style={styles.smallButton}>
                  <ThemedText type="small">Remove photo</ThemedText>
                </ThemedView>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={findProduct} disabled={searching}>
              <ThemedView type="backgroundElement" style={styles.smallButton}>
                <ThemedText type="smallBold">
                  {searching ? 'Searching…' : 'Find photo & size'}
                </ThemedText>
              </ThemedView>
            </Pressable>
          )}
        </ThemedView>

        {searchError ? (
          <ThemedText type="small" themeColor="textSecondary">
            {searchError}
          </ThemedText>
        ) : null}

        {results && results.length > 0 && (
          <ThemedView style={styles.results}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Pick a match from Open Food Facts
            </ThemedText>
            {results.map((product) => (
              <Pressable key={product.code} onPress={() => applyProduct(product)}>
                {({ pressed }) => (
                  <ThemedView
                    type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                    style={styles.resultRow}>
                    {product.imageSmallUrl ? (
                      <Image
                        source={product.imageSmallUrl}
                        style={styles.resultImage}
                        contentFit="contain"
                        transition={150}
                      />
                    ) : (
                      <ThemedView type="backgroundSelected" style={styles.resultImage} />
                    )}
                    <ThemedView
                      type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.resultText}>
                      <ThemedText type="small" numberOfLines={1}>
                        {product.name}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                        {[product.brand, product.sizeLabel].filter(Boolean).join(' · ') || '—'}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                )}
              </Pressable>
            ))}
            <Pressable onPress={() => setResults(null)}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.dismiss}>
                None of these
              </ThemedText>
            </Pressable>
          </ThemedView>
        )}

        <ThemedText type="smallBold" themeColor="textSecondary">
          Quantity
        </ThemedText>
        <ThemedView style={styles.quantityRow}>
          <TextInput
            value={quantity}
            onChangeText={setQuantity}
            placeholder="280"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            style={[...inputStyle, styles.quantityInput]}
          />
          <ThemedView style={styles.unitRow}>
            {PANTRY_UNITS.map((u) => (
              <Pressable key={u} onPress={() => setUnit(u)}>
                <ThemedView
                  type={unit === u ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.unitPill}>
                  <ThemedText type={unit === u ? 'smallBold' : 'small'}>{u}</ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </ThemedView>
        <ThemedText type="small" themeColor="textSecondary">
          g for solids by weight, ml for liquids, each for countable things (eggs, cans).
          {quantity && !Number.isNaN(Number(quantity.replace(',', '.'))) && unit !== 'each'
            ? ` Shown as ${formatQuantity(Number(quantity.replace(',', '.')), unit)}.`
            : ''}
        </ThemedText>

        <ThemedText type="smallBold" themeColor="textSecondary">
          Category (optional)
        </ThemedText>
        <TextInput
          value={category}
          onChangeText={setCategory}
          placeholder="Baking"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        {nutrition && <NutritionPanel nutrition={nutrition} />}

        {error ? (
          <ThemedText type="smallBold" style={[styles.error, { color: theme.danger }]}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable onPress={save}>
          <ThemedView type="backgroundSelected" style={styles.saveButton}>
            <ThemedText type="smallBold">{isNew ? 'Add to pantry' : 'Save changes'}</ThemedText>
          </ThemedView>
        </Pressable>

        {!isNew &&
          (confirmingDelete ? (
            <ConfirmPanel
              message={`Delete “${name}” from your pantry?`}
              confirmLabel="Delete"
              destructive
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirmingDelete(false)}
            />
          ) : (
            <Pressable onPress={() => setConfirmingDelete(true)}>
              <ThemedView type="backgroundElement" style={styles.deleteButton}>
                <ThemedText type="smallBold" style={[styles.deleteText, { color: theme.danger }]}>
                  Delete item
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
      </ScrollView>
    </ThemedView>
  );
}

const NUTRITION_ROWS: {
  key: keyof Nutrition;
  label: string;
  unit: string;
  indented?: boolean;
}[] = [
  { key: 'energyKcal', label: 'Energy', unit: 'kcal' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'saturatedFat', label: 'of which saturates', unit: 'g', indented: true },
  { key: 'carbs', label: 'Carbohydrate', unit: 'g' },
  { key: 'sugars', label: 'of which sugars', unit: 'g', indented: true },
  { key: 'fiber', label: 'Fibre', unit: 'g' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'salt', label: 'Salt', unit: 'g' },
  { key: 'sodium', label: 'Sodium', unit: 'g' },
];

function NutritionPanel({ nutrition }: { nutrition: Nutrition }) {
  const [expanded, setExpanded] = useState(false);
  const rows = NUTRITION_ROWS.filter((row) => typeof nutrition[row.key] === 'number');
  if (rows.length === 0) return null;

  const energy = nutrition.energyKcal;

  return (
    <>
      <Pressable onPress={() => setExpanded((open) => !open)}>
        {({ pressed }) => (
          <ThemedView
            type={pressed ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.nutritionHeader}>
            <ThemedView
              type={pressed ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.nutritionHeaderText}>
              <ThemedText type="smallBold">Nutrition per 100 g</ThemedText>
              {!expanded && typeof energy === 'number' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {formatNutrient(energy)} kcal · {rows.length} facts
                </ThemedText>
              ) : null}
            </ThemedView>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {expanded ? '▲' : '▼'}
            </ThemedText>
          </ThemedView>
        )}
      </Pressable>

      {expanded && (
        <>
          <ThemedView type="backgroundElement" style={styles.nutritionCard}>
            {rows.map((row, index) => (
              <ThemedView
                key={row.key}
                type="backgroundElement"
                style={[styles.nutritionRow, index > 0 && styles.nutritionRowBorder]}>
                <ThemedText
                  type="small"
                  themeColor="textSecondary"
                  style={row.indented ? styles.nutritionSubLabel : undefined}>
                  {row.label}
                </ThemedText>
                <ThemedText type="smallBold">
                  {formatNutrient(nutrition[row.key]!)} {row.unit}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            From Open Food Facts. Values are for the matched product, so treat them as a guide.
          </ThemedText>
        </>
      )}
    </>
  );
}

function formatNutrient(value: number): string {
  return Number(value.toFixed(value < 10 ? 1 : 0)).toString();
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    padding: 20,
    gap: 10,
  },
  nutritionHeader: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  nutritionHeaderText: {
    flex: 1,
    gap: 2,
  },
  nutritionCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 9,
    gap: 12,
  },
  nutritionRowBorder: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  nutritionSubLabel: {
    paddingLeft: 12,
  },
  input: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 10,
  },
  smallButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  results: {
    gap: 6,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 10,
    padding: 8,
  },
  resultImage: {
    width: 40,
    height: 40,
    borderRadius: 6,
  },
  resultText: {
    flex: 1,
    gap: 1,
  },
  dismiss: {
    textAlign: 'center',
    paddingVertical: 6,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  quantityInput: {
    flexGrow: 1,
    flexBasis: 120,
  },
  unitRow: {
    flexDirection: 'row',
    gap: 6,
  },
  unitPill: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  error: {
  },
  saveButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
  },
});

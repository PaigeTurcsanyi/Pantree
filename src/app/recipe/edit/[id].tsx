import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { parseRecipeScreenshot } from '@/api/gemini';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PANTRY_UNITS, PantryUnit } from '@/db/pantry';
import { getRecipe, insertRecipe, updateRecipe } from '@/db/recipes';
import { getGeminiApiKey } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';

type IngredientDraft = {
  name: string;
  amount: string;
  unit: PantryUnit;
};

const emptyIngredient = (): IngredientDraft => ({ name: '', amount: '', unit: 'g' });

export default function RecipeEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const recipeId = isNew ? null : Number(id);

  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [servings, setServings] = useState('');
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([emptyIngredient()]);
  const [steps, setSteps] = useState<string[]>(['']);
  const [notes, setNotes] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);

  useEffect(() => {
    if (recipeId === null) return;
    getRecipe(db, recipeId).then((recipe) => {
      if (!recipe) return;
      setTitle(recipe.title);
      setServings(recipe.servings ? String(recipe.servings) : '');
      setNotes(recipe.notes ?? '');
      setPhotoUrl(recipe.photo_url);
      setSteps(recipe.steps.length ? recipe.steps : ['']);
      setIngredients(
        recipe.ingredients.length
          ? recipe.ingredients.map((ingredient) => ({
              name: ingredient.name,
              amount: String(ingredient.amount),
              unit: ingredient.unit,
            }))
          : [emptyIngredient()]
      );
    });
  }, [db, recipeId]);

  /** Reads a recipe out of a screenshot and fills the form with it. */
  const importFromScreenshot = async () => {
    setError('');
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (picked.canceled) return;
    const asset = picked.assets[0];
    if (!asset.base64) {
      setError('Couldn’t read that image. Try another one.');
      return;
    }

    setReading(true);
    try {
      const apiKey = await getGeminiApiKey(db);
      if (!apiKey) {
        setError('No Gemini API key set. Add one in Settings.');
        return;
      }
      const recipe = await parseRecipeScreenshot(
        asset.base64,
        asset.mimeType ?? 'image/jpeg',
        apiKey
      );
      setTitle(recipe.title);
      setServings(recipe.servings ? String(recipe.servings) : '');
      setIngredients(
        recipe.ingredients.length
          ? recipe.ingredients.map((i) => ({
              name: i.name,
              amount: String(i.amount),
              unit: i.unit,
            }))
          : [emptyIngredient()]
      );
      setSteps(recipe.steps.length ? recipe.steps : ['']);
      // Keep the screenshot as the recipe's picture unless one is already set.
      if (!photoUrl) setPhotoUrl(asset.uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setReading(false);
    }
  };

  const pickPhoto = async () => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled) return;
    setPhotoUrl(picked.assets[0].uri);
  };

  const updateIngredient = (index: number, patch: Partial<IngredientDraft>) => {
    setIngredients((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const save = async () => {
    if (!title.trim()) {
      setError('Give the recipe a title.');
      return;
    }
    const filled = ingredients.filter((ingredient) => ingredient.name.trim());
    for (const ingredient of filled) {
      const amount = Number(ingredient.amount.replace(',', '.'));
      if (!ingredient.amount.trim() || Number.isNaN(amount) || amount <= 0) {
        setError(`“${ingredient.name}” needs an amount greater than 0.`);
        return;
      }
    }
    const parsedServings = servings.trim() ? Number(servings.replace(',', '.')) : null;
    if (parsedServings !== null && (Number.isNaN(parsedServings) || parsedServings <= 0)) {
      setError('Servings must be a number greater than 0.');
      return;
    }

    const input = {
      title,
      servings: parsedServings,
      steps: steps.map((step) => step.trim()).filter(Boolean),
      notes,
      photo_url: photoUrl,
      ingredients: filled.map((ingredient) => ({
        name: ingredient.name,
        amount: Number(ingredient.amount.replace(',', '.')),
        unit: ingredient.unit,
      })),
    };

    if (recipeId === null) {
      const newId = await insertRecipe(db, input);
      router.replace(`/recipe/${newId}`);
    } else {
      await updateRecipe(db, recipeId, input);
      router.back();
    }
  };

  const inputStyle = [styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }];

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: isNew ? 'New recipe' : 'Edit recipe' }} />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Pressable onPress={importFromScreenshot} disabled={reading}>
          <ThemedView type="backgroundElement" style={styles.importButton}>
            {reading ? (
              <ActivityIndicator />
            ) : (
              <ThemedText type="smallBold">Fill this in from a screenshot</ThemedText>
            )}
          </ThemedView>
        </Pressable>
        <ThemedText type="small" themeColor="textSecondary">
          Reads a recipe photo or screenshot and fills in the fields below. You can fix anything
          before saving.
        </ThemedText>

        <ThemedView style={styles.photoRow}>
          {photoUrl ? (
            <>
              <Image source={photoUrl} style={styles.photo} contentFit="cover" transition={150} />
              <Pressable onPress={pickPhoto}>
                <ThemedView type="backgroundElement" style={styles.smallButton}>
                  <ThemedText type="small">Change photo</ThemedText>
                </ThemedView>
              </Pressable>
              <Pressable onPress={() => setPhotoUrl(null)}>
                <ThemedView type="backgroundElement" style={styles.smallButton}>
                  <ThemedText type="small" style={styles.removeText}>
                    Remove
                  </ThemedText>
                </ThemedView>
              </Pressable>
            </>
          ) : (
            <Pressable onPress={pickPhoto}>
              <ThemedView type="backgroundElement" style={styles.smallButton}>
                <ThemedText type="smallBold">Add a photo</ThemedText>
              </ThemedView>
            </Pressable>
          )}
        </ThemedView>

        <ThemedText type="smallBold" themeColor="textSecondary">
          Title
        </ThemedText>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Banana bread"
          placeholderTextColor={theme.textSecondary}
          style={inputStyle}
        />

        <ThemedText type="smallBold" themeColor="textSecondary">
          Servings (optional)
        </ThemedText>
        <TextInput
          value={servings}
          onChangeText={setServings}
          placeholder="4"
          placeholderTextColor={theme.textSecondary}
          keyboardType="decimal-pad"
          style={inputStyle}
        />

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
          Ingredients
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Use grams, ml, or each so the app can subtract them from your pantry later.
        </ThemedText>
        {ingredients.map((ingredient, index) => (
          <ThemedView key={index} type="backgroundElement" style={styles.card}>
            <TextInput
              value={ingredient.name}
              onChangeText={(name) => updateIngredient(index, { name })}
              placeholder="Flour"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { backgroundColor: theme.background, color: theme.text }]}
            />
            <ThemedView type="backgroundElement" style={styles.amountRow}>
              <TextInput
                value={ingredient.amount}
                onChangeText={(amount) => updateIngredient(index, { amount })}
                placeholder="280"
                placeholderTextColor={theme.textSecondary}
                keyboardType="decimal-pad"
                style={[
                  styles.input,
                  styles.amountInput,
                  { backgroundColor: theme.background, color: theme.text },
                ]}
              />
              {PANTRY_UNITS.map((u) => (
                <Pressable key={u} onPress={() => updateIngredient(index, { unit: u })}>
                  <ThemedView
                    type={ingredient.unit === u ? 'backgroundSelected' : 'background'}
                    style={styles.unitPill}>
                    <ThemedText type={ingredient.unit === u ? 'smallBold' : 'small'}>{u}</ThemedText>
                  </ThemedView>
                </Pressable>
              ))}
            </ThemedView>
            {ingredients.length > 1 && (
              <Pressable
                onPress={() => setIngredients((prev) => prev.filter((_, i) => i !== index))}>
                <ThemedText type="small" style={styles.removeText}>
                  Remove
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        ))}
        <Pressable onPress={() => setIngredients((prev) => [...prev, emptyIngredient()])}>
          <ThemedView type="backgroundElement" style={styles.smallButton}>
            <ThemedText type="smallBold">+ Add ingredient</ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
          Steps
        </ThemedText>
        {steps.map((step, index) => (
          <ThemedView key={index} style={styles.stepRow}>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.stepNumber}>
              {index + 1}
            </ThemedText>
            <TextInput
              value={step}
              onChangeText={(text) =>
                setSteps((prev) => prev.map((s, i) => (i === index ? text : s)))
              }
              placeholder="Mix the dry ingredients"
              placeholderTextColor={theme.textSecondary}
              multiline
              style={[...inputStyle, styles.stepInput]}
            />
            {steps.length > 1 && (
              <Pressable onPress={() => setSteps((prev) => prev.filter((_, i) => i !== index))}>
                <ThemedText type="small" style={styles.removeText}>
                  ✕
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        ))}
        <Pressable onPress={() => setSteps((prev) => [...prev, ''])}>
          <ThemedView type="backgroundElement" style={styles.smallButton}>
            <ThemedText type="smallBold">+ Add step</ThemedText>
          </ThemedView>
        </Pressable>

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
          Notes (optional)
        </ThemedText>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Freezes well"
          placeholderTextColor={theme.textSecondary}
          multiline
          style={[...inputStyle, styles.notesInput]}
        />

        {error ? (
          <ThemedText type="smallBold" style={styles.removeText}>
            {error}
          </ThemedText>
        ) : null}

        <Pressable onPress={save}>
          <ThemedView type="backgroundSelected" style={styles.saveButton}>
            <ThemedText type="smallBold">{isNew ? 'Save recipe' : 'Save changes'}</ThemedText>
          </ThemedView>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  form: {
    padding: 20,
    gap: 8,
    paddingBottom: 40,
  },
  sectionHeading: {
    marginTop: 16,
  },
  input: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  amountInput: {
    flexGrow: 1,
    flexBasis: 100,
  },
  unitPill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  smallButton: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
  },
  importButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  stepNumber: {
    paddingTop: 14,
    minWidth: 16,
  },
  stepInput: {
    flex: 1,
    minHeight: 44,
  },
  notesInput: {
    minHeight: 70,
  },
  removeText: {
    color: '#e5484d',
    textAlign: 'center',
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  saveButton: {
    marginTop: 16,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
});

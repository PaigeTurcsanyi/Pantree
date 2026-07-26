import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PANTRY_UNITS, PantryUnit } from '@/db/pantry';
import { getRecipe, insertRecipe, updateRecipe } from '@/db/recipes';
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
  const [error, setError] = useState('');

  useEffect(() => {
    if (recipeId === null) return;
    getRecipe(db, recipeId).then((recipe) => {
      if (!recipe) return;
      setTitle(recipe.title);
      setServings(recipe.servings ? String(recipe.servings) : '');
      setNotes(recipe.notes ?? '');
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
    alignItems: 'center',
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

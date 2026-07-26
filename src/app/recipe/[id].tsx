import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatQuantity } from '@/db/pantry';
import { deleteRecipe, getRecipe, RecipeWithIngredients } from '@/db/recipes';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getRecipe(db, recipeId).then((found) => {
        setRecipe(found);
        setLoaded(true);
      });
    }, [db, recipeId])
  );

  const confirmDelete = () => {
    const doDelete = async () => {
      await deleteRecipe(db, recipeId);
      router.back();
    };
    const message = `Delete “${recipe?.title ?? 'this recipe'}”?`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) void doDelete();
    } else {
      Alert.alert('Delete recipe', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => void doDelete() },
      ]);
    }
  };

  if (!recipe) {
    return (
      <ThemedView style={styles.container}>
        <Stack.Screen options={{ title: 'Recipe' }} />
        {loaded && (
          <ThemedText themeColor="textSecondary" style={styles.missing}>
            This recipe no longer exists.
          </ThemedText>
        )}
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: recipe.title }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="subtitle">{recipe.title}</ThemedText>
        {recipe.servings ? (
          <ThemedText type="small" themeColor="textSecondary">
            Serves {recipe.servings}
          </ThemedText>
        ) : null}

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
          Ingredients
        </ThemedText>
        {recipe.ingredients.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No ingredients listed.
          </ThemedText>
        ) : (
          <ThemedView type="backgroundElement" style={styles.card}>
            {recipe.ingredients.map((ingredient) => (
              <ThemedView key={ingredient.id} type="backgroundElement" style={styles.ingredientRow}>
                <ThemedText style={styles.ingredientName}>{ingredient.name}</ThemedText>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {formatQuantity(ingredient.amount, ingredient.unit)}
                </ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        )}

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
          Steps
        </ThemedText>
        {recipe.steps.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No steps written yet.
          </ThemedText>
        ) : (
          <ThemedView style={styles.steps}>
            {recipe.steps.map((step, index) => (
              <ThemedView key={index} style={styles.stepRow}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.stepNumber}>
                  {index + 1}
                </ThemedText>
                <ThemedText style={styles.stepText}>{step}</ThemedText>
              </ThemedView>
            ))}
          </ThemedView>
        )}

        {recipe.notes ? (
          <>
            <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
              Notes
            </ThemedText>
            <ThemedText type="small">{recipe.notes}</ThemedText>
          </>
        ) : null}

        <Pressable onPress={() => router.push(`/recipe/edit/${recipe.id}`)}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            <ThemedText type="smallBold">Edit recipe</ThemedText>
          </ThemedView>
        </Pressable>

        <Pressable onPress={confirmDelete}>
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText type="smallBold" style={styles.deleteText}>
              Delete recipe
            </ThemedText>
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
  content: {
    padding: 20,
    gap: 8,
    paddingBottom: 40,
  },
  missing: {
    textAlign: 'center',
    padding: 40,
  },
  sectionHeading: {
    marginTop: 16,
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  ingredientName: {
    flex: 1,
  },
  steps: {
    gap: 10,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 10,
  },
  stepNumber: {
    minWidth: 18,
    paddingTop: 3,
  },
  stepText: {
    flex: 1,
  },
  button: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
    color: '#e5484d',
  },
});

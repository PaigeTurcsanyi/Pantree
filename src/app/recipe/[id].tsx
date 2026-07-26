import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { checkIngredients, deductRecipe, IngredientCheck, RecipeCheck } from '@/db/cooking';
import { formatQuantity, listPantryItems } from '@/db/pantry';
import { deleteRecipe, getRecipe, RecipeWithIngredients } from '@/db/recipes';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [check, setCheck] = useState<RecipeCheck | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [madeMessage, setMadeMessage] = useState('');

  const load = useCallback(async () => {
    const found = await getRecipe(db, recipeId);
    setRecipe(found);
    if (found) {
      const pantry = await listPantryItems(db);
      setCheck(checkIngredients(found.ingredients, pantry));
    }
    setLoaded(true);
  }, [db, recipeId]);

  useFocusEffect(
    useCallback(() => {
      setMadeMessage('');
      void load();
    }, [load])
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

  const confirmMade = () => {
    if (!check || !recipe) return;
    const doDeduct = async () => {
      const { deducted, skipped } = await deductRecipe(db, check.checks);
      await load();
      const deductedText = `Deducted ${deducted} ingredient${deducted === 1 ? '' : 's'}`;
      setMadeMessage(
        skipped > 0
          ? `${deductedText}. ${skipped} ${skipped === 1 ? 'wasn’t' : 'weren’t'} in your pantry, so nothing was subtracted for ${skipped === 1 ? 'it' : 'those'}.`
          : `${deductedText} from your pantry.`
      );
    };

    const lines = check.checks
      .filter((c) => c.match)
      .map(
        (c) =>
          `${c.match!.name}: ${formatQuantity(c.match!.quantity, c.match!.unit)} → ${formatQuantity(
            Math.max(0, c.match!.quantity - c.needed),
            c.match!.unit
          )}`
      );
    const message =
      lines.length > 0
        ? `This will update your pantry:\n\n${lines.join('\n')}`
        : 'None of these ingredients match pantry items, so nothing will change.';

    if (Platform.OS === 'web') {
      if (window.confirm(message)) void doDeduct();
    } else {
      Alert.alert('I made this', message, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Deduct', onPress: () => void doDeduct() },
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

        {check && <MakeStatus check={check} />}

        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionHeading}>
          Ingredients
        </ThemedText>
        {recipe.ingredients.length === 0 ? (
          <ThemedText type="small" themeColor="textSecondary">
            No ingredients listed.
          </ThemedText>
        ) : (
          <ThemedView type="backgroundElement" style={styles.card}>
            {(check?.checks ?? []).map((item) => (
              <IngredientRow key={item.ingredient.id} check={item} />
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

        {madeMessage ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.madeMessage}>
            {madeMessage}
          </ThemedText>
        ) : null}

        {recipe.ingredients.length > 0 && (
          <Pressable onPress={confirmMade}>
            <ThemedView type="backgroundSelected" style={styles.button}>
              <ThemedText type="smallBold">I made this</ThemedText>
            </ThemedView>
          </Pressable>
        )}

        <Pressable onPress={() => router.push(`/recipe/edit/${recipe.id}`)}>
          <ThemedView type="backgroundElement" style={styles.button}>
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

function MakeStatus({ check }: { check: RecipeCheck }) {
  if (check.canMake) {
    return (
      <ThemedView type="backgroundElement" style={styles.statusBanner}>
        <ThemedText type="smallBold" style={styles.okText}>
          You have everything for this.
        </ThemedText>
      </ThemedView>
    );
  }

  const missing = check.problems.filter((p) => p.status === 'missing');
  const short = check.problems.filter((p) => p.status === 'short');

  return (
    <ThemedView type="backgroundElement" style={styles.statusBanner}>
      <ThemedText type="smallBold" style={styles.warnText}>
        {missing.length > 0 && `Missing ${missing.map((p) => p.ingredient.name).join(', ')}`}
        {missing.length > 0 && short.length > 0 && ' · '}
        {short.length > 0 && `Short on ${short.map((p) => p.ingredient.name).join(', ')}`}
      </ThemedText>
    </ThemedView>
  );
}

function IngredientRow({ check }: { check: IngredientCheck }) {
  const { ingredient, match, status, needed, available } = check;
  const color = status === 'enough' ? undefined : status === 'short' ? '#f5a524' : '#e5484d';

  return (
    <ThemedView type="backgroundElement" style={styles.ingredientRow}>
      <ThemedView type="backgroundElement" style={styles.ingredientText}>
        <ThemedText>{ingredient.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {status === 'missing'
            ? 'not in pantry'
            : status === 'short'
              ? `only ${formatQuantity(available, ingredient.unit)} left`
              : `${formatQuantity(available, ingredient.unit)} in pantry${
                  match && match.name.toLowerCase() !== ingredient.name.toLowerCase()
                    ? ` (${match.name})`
                    : ''
                }`}
        </ThemedText>
      </ThemedView>
      <ThemedText type="smallBold" style={color ? { color } : undefined}>
        {formatQuantity(needed, ingredient.unit)}
      </ThemedText>
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
  statusBanner: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  okText: {
    color: '#30a46c',
  },
  warnText: {
    color: '#f5a524',
  },
  card: {
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  ingredientText: {
    flex: 1,
    gap: 1,
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
  madeMessage: {
    marginTop: 12,
  },
  button: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteText: {
    color: '#e5484d',
  },
});

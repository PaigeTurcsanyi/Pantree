import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ConfirmPanel } from '@/components/confirm-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  checkIngredients,
  deductRecipe,
  IngredientCheck,
  RecipeCheck,
  suggestScale,
} from '@/db/cooking';
import { formatQuantity, listPantryItems } from '@/db/pantry';
import { deleteRecipe, getRecipe, RecipeWithIngredients } from '@/db/recipes';
import { listSubstitutions } from '@/db/substitutions';

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeWithIngredients | null>(null);
  const [check, setCheck] = useState<RecipeCheck | null>(null);
  const [scale, setScale] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [madeMessage, setMadeMessage] = useState('');
  const [confirming, setConfirming] = useState<'made' | 'delete' | null>(null);

  const load = useCallback(
    async (nextScale: number) => {
      const found = await getRecipe(db, recipeId);
      setRecipe(found);
      if (found) {
        const [pantry, substitutions] = await Promise.all([
          listPantryItems(db),
          listSubstitutions(db),
        ]);
        setCheck(checkIngredients(found.ingredients, pantry, nextScale, substitutions));
      }
      setLoaded(true);
    },
    [db, recipeId]
  );

  useFocusEffect(
    useCallback(() => {
      setMadeMessage('');
      setScale(1);
      setConfirming(null);
      void load(1);
    }, [load])
  );

  const applyScale = (next: number) => {
    setScale(next);
    setMadeMessage('');
    void load(next);
  };

  // Suggested "fit my pantry" scale, always measured against a full batch.
  const fitScale = check && scale === 1 ? suggestScale(check) : null;

  const doDelete = async () => {
    await deleteRecipe(db, recipeId);
    if (router.canGoBack()) router.back();
    else router.replace('/recipes');
  };

  const doDeduct = async () => {
    if (!check) return;
    setConfirming(null);
    const { deducted, skipped } = await deductRecipe(db, check.checks);
    await load(scale);
    const deductedText = `Deducted ${deducted} ingredient${deducted === 1 ? '' : 's'}`;
    setMadeMessage(
      skipped > 0
        ? `${deductedText}. ${skipped} ${skipped === 1 ? 'wasn’t' : 'weren’t'} in your pantry, so nothing was subtracted for ${skipped === 1 ? 'it' : 'those'}.`
        : `${deductedText} from your pantry.`
    );
  };

  /** Preview of exactly what "I made this" will change. */
  const deductionPreview = () => {
    if (!check) return '';
    const lines = check.checks
      .filter((c) => c.match)
      .map(
        (c) =>
          `${c.match!.name}: ${formatQuantity(c.match!.quantity, c.match!.unit)} → ${formatQuantity(
            Math.max(0, c.match!.quantity - c.needed),
            c.match!.unit
          )}`
      );
    return lines.length > 0
      ? `This will update your pantry:\n\n${lines.join('\n')}`
      : 'None of these ingredients match pantry items, so nothing will change.';
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
            Serves {formatNumber(recipe.servings * scale)}
            {scale !== 1 ? ` (${formatNumber(recipe.servings)} at full batch)` : ''}
          </ThemedText>
        ) : null}

        {check && <MakeStatus check={check} />}

        {recipe.ingredients.length > 0 && (
          <ThemedView style={styles.scaleRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Batch
            </ThemedText>
            {[0.5, 1, 2].map((option) => (
              <Pressable key={option} onPress={() => applyScale(option)}>
                <ThemedView
                  type={scale === option ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.scalePill}>
                  <ThemedText type={scale === option ? 'smallBold' : 'small'}>
                    {formatNumber(option)}×
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
            {scale !== 1 && ![0.5, 2].includes(scale) && (
              <ThemedView type="backgroundSelected" style={styles.scalePill}>
                <ThemedText type="smallBold">{formatNumber(scale)}×</ThemedText>
              </ThemedView>
            )}
          </ThemedView>
        )}

        {fitScale !== null && (
          <Pressable onPress={() => applyScale(fitScale)}>
            <ThemedView type="backgroundElement" style={styles.fitBanner}>
              <ThemedText type="smallBold" style={styles.warnText}>
                Scale down to {formatNumber(fitScale)}× to fit your pantry
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Every amount is recalculated so the ratios stay right.
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}

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

        {recipe.ingredients.length > 0 &&
          (confirming === 'made' ? (
            <ConfirmPanel
              message={deductionPreview()}
              confirmLabel="Deduct"
              onConfirm={() => void doDeduct()}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <Pressable onPress={() => setConfirming('made')}>
              <ThemedView type="backgroundSelected" style={styles.button}>
                <ThemedText type="smallBold">
                  {scale === 1 ? 'I made this' : `I made this (${formatNumber(scale)}× batch)`}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}

        <Pressable onPress={() => router.push(`/recipe/edit/${recipe.id}`)}>
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText type="smallBold">Edit recipe</ThemedText>
          </ThemedView>
        </Pressable>

        {confirming === 'delete' ? (
          <ConfirmPanel
            message={`Delete “${recipe.title}”?`}
            confirmLabel="Delete"
            destructive
            onConfirm={() => void doDelete()}
            onCancel={() => setConfirming(null)}
          />
        ) : (
          <Pressable onPress={() => setConfirming('delete')}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText type="smallBold" style={styles.deleteText}>
                Delete recipe
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
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
      {check.canMakeWithSubstitutes && (
        <ThemedText type="small" themeColor="textSecondary">
          You can still make this using the swaps below.
        </ThemedText>
      )}
    </ThemedView>
  );
}

function IngredientRow({ check }: { check: IngredientCheck }) {
  const { ingredient, match, status, needed, available, substitutes } = check;
  const color = status === 'enough' ? undefined : status === 'short' ? '#f5a524' : '#e5484d';
  const swap = substitutes[0];

  return (
    <ThemedView type="backgroundElement" style={styles.ingredientBlock}>
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

      {swap && (
        <ThemedView type="backgroundElement" style={styles.substitute}>
          <ThemedText type="small" style={styles.substituteText}>
            Swap: {formatQuantity(swap.amount, ingredient.unit)} {swap.item.name}
          </ThemedText>
          {swap.substitution.notes ? (
            <ThemedText type="small" themeColor="textSecondary">
              {swap.substitution.notes}
            </ThemedText>
          ) : null}
        </ThemedView>
      )}
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
  scaleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  scalePill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  fitBanner: {
    marginTop: 8,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 2,
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
  ingredientBlock: {
    gap: 6,
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  substitute: {
    borderLeftWidth: 2,
    borderLeftColor: '#f5a524',
    paddingLeft: 10,
    gap: 1,
  },
  substituteText: {
    color: '#f5a524',
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

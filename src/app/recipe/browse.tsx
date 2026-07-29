import { Image } from 'expo-image';
import { Stack, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { foodIconFor, Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { formatQuantity } from '@/db/pantry';
import { insertRecipe, listRecipes } from '@/db/recipes';
import { STARTER_RECIPES, type StarterRecipe } from '@/data/starter-recipes';
import { useTheme } from '@/hooks/use-theme';

export default function BrowseRecipesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [existing, setExisting] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const rows = await listRecipes(db);
    setExisting(new Set(rows.map((r) => r.title.trim().toLowerCase())));
  }, [db]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async (recipe: StarterRecipe) => {
    setAdding(recipe.title);
    try {
      const id = await insertRecipe(db, {
        title: recipe.title,
        servings: recipe.servings,
        steps: recipe.steps,
        notes: recipe.notes ?? null,
        ingredients: recipe.ingredients,
      });
      router.replace(`/recipe/${id}`);
    } finally {
      setAdding(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Starter recipes' }} />
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="meta" themeColor="textSecondary">
          Built into the app. Adding one copies it into your book, where you can edit it like
          anything else.
        </ThemedText>

        {STARTER_RECIPES.map((recipe) => (
          <StarterCard
            key={recipe.title}
            recipe={recipe}
            added={existing.has(recipe.title.trim().toLowerCase())}
            busy={adding === recipe.title}
            onAdd={() => add(recipe)}
          />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

function StarterCard({
  recipe,
  added,
  busy,
  onAdd,
}: {
  recipe: StarterRecipe;
  added: boolean;
  busy: boolean;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const summary = recipe.ingredients
    .map((i) => `${formatQuantity(i.amount, i.unit)} ${i.name.toLowerCase()}`)
    .join(' · ');

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
      <View style={styles.cardHead}>
        <View style={[styles.tile, { backgroundColor: theme.surfaceSunken }]}>
          {recipe.image ? (
            <Image source={recipe.image} style={styles.tileImage} contentFit="cover" />
          ) : (
            <Icon name={foodIconFor(recipe.title)} size={26} color={theme.accent} />
          )}
        </View>
        <View style={styles.cardText}>
          <ThemedText type="cardTitle">{recipe.title}</ThemedText>
          {recipe.servings ? (
            <ThemedText type="meta" themeColor="textMuted">
              Serves {recipe.servings} · {recipe.ingredients.length} ingredients
            </ThemedText>
          ) : null}
        </View>
      </View>

      <ThemedText type="meta" themeColor="textSecondary" numberOfLines={2}>
        {summary}
      </ThemedText>

      {added ? (
        <View style={[styles.addedChip, { backgroundColor: theme.successSoft }]}>
          <Icon name="eco" size={14} color={theme.success} />
          <ThemedText type="chip" style={{ color: theme.success }}>
            Already in your book
          </ThemedText>
        </View>
      ) : (
        <Pressable onPress={onAdd} disabled={busy}>
          {({ pressed }) => (
            <View
              style={[
                styles.addButton,
                { backgroundColor: theme.accent },
                pressed && styles.pressed,
              ]}>
              <ThemedText type="chip" style={{ color: theme.accentText }}>
                {busy ? 'Adding…' : 'Add to my book'}
              </ThemedText>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.screen,
    gap: Spacing.row,
  },
  card: {
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 14,
    gap: Spacing.two,
    ...Shadows.card,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  tile: {
    width: 52,
    height: 52,
    borderRadius: Radius.thumbnail,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  addButton: {
    borderRadius: Radius.button,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 2,
  },
  pressed: {
    opacity: 0.85,
  },
  addedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: Radius.button,
    paddingVertical: 12,
    marginTop: 2,
  },
});

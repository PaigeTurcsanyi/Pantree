import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { checkIngredients, RecipeCheck } from '@/db/cooking';
import { listPantryItems } from '@/db/pantry';
import { getRecipe, listRecipes, Recipe } from '@/db/recipes';
import { listSubstitutions } from '@/db/substitutions';
import { useTheme } from '@/hooks/use-theme';

type Filter = 'all' | 'ready' | 'almost';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'ready', label: 'Can make' },
  { key: 'almost', label: 'Almost' },
];

type Evaluated = Recipe & { check: RecipeCheck | null };

export default function RecipesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [recipes, setRecipes] = useState<Evaluated[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [rows, pantry, substitutions] = await Promise.all([
      listRecipes(db, search),
      listPantryItems(db),
      listSubstitutions(db),
    ]);

    const evaluated: Evaluated[] = [];
    for (const recipe of rows) {
      const full = await getRecipe(db, recipe.id);
      evaluated.push({
        ...recipe,
        check:
          full && full.ingredients.length > 0
            ? checkIngredients(full.ingredients, pantry, 1, substitutions)
            : null,
      });
    }
    setRecipes(evaluated);
    setLoaded(true);
  }, [db, search]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const visible = recipes.filter((recipe) => {
    if (filter === 'all') return true;
    if (!recipe.check) return false;
    if (filter === 'ready') return recipe.check.canMake;
    return (
      !recipe.check.canMake &&
      (recipe.check.canMakeWithSubstitutes || recipe.check.problems.length <= 2)
    );
  });

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Recipes</ThemedText>
        <Pressable
          onPress={() => router.push('/recipe/edit/new')}
          style={[styles.addButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">+ Add</ThemedText>
        </Pressable>
      </ThemedView>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search recipes"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      <ThemedView style={styles.filterRow}>
        {FILTERS.map(({ key, label }) => {
          const count =
            key === 'all'
              ? recipes.length
              : recipes.filter((r) => {
                  if (!r.check) return false;
                  if (key === 'ready') return r.check.canMake;
                  return (
                    !r.check.canMake &&
                    (r.check.canMakeWithSubstitutes || r.check.problems.length <= 2)
                  );
                }).length;

          return (
            <Pressable key={key} onPress={() => setFilter(key)}>
              <ThemedView
                type={filter === key ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.filterPill}>
                <ThemedText type={filter === key ? 'smallBold' : 'small'}>
                  {label} {count}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </ThemedView>

      <FlatList
        data={visible}
        keyExtractor={(recipe) => String(recipe.id)}
        contentContainerStyle={visible.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/recipe/${item.id}`)}>
            {({ pressed }) => (
              <ThemedView
                type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.row}>
                {item.photo_url ? (
                  <Image
                    source={item.photo_url}
                    style={styles.thumbnail}
                    contentFit="cover"
                    transition={150}
                  />
                ) : null}
                <ThemedView
                  type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.rowText}>
                  <ThemedText>{item.title}</ThemedText>
                  <ThemedText type="small" style={statusStyle(item.check)}>
                    {statusLabel(item.check)}
                  </ThemedText>
                </ThemedView>
              </ThemedView>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loaded ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {emptyMessage(filter, search)}
            </ThemedText>
          ) : null
        }
      />
    </ThemedView>
  );
}

function statusLabel(check: RecipeCheck | null): string {
  if (!check) return 'No ingredients yet';
  if (check.canMake) return 'You have everything';
  if (check.canMakeWithSubstitutes) return 'Makeable with swaps';
  const missing = check.problems.map((p) => p.ingredient.name);
  if (missing.length <= 2) return `Need ${missing.join(' and ')}`;
  return `Missing ${missing.length} ingredients`;
}

function statusStyle(check: RecipeCheck | null) {
  if (!check) return styles.mutedStatus;
  if (check.canMake) return styles.okStatus;
  if (check.canMakeWithSubstitutes || check.problems.length <= 2) return styles.warnStatus;
  return styles.mutedStatus;
}

function emptyMessage(filter: Filter, search: string): string {
  if (search) return `No recipes match “${search}”.`;
  if (filter === 'ready') return 'Nothing you can make right now. Check “Almost”.';
  if (filter === 'almost') return 'Nothing close by. Add a few pantry items.';
  return 'No recipes yet. Tap “+ Add” to write one down or import a screenshot.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  search: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 10,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  list: {
    gap: 8,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  okStatus: {
    color: '#30a46c',
  },
  warnStatus: {
    color: '#f5a524',
  },
  mutedStatus: {
    color: '#8b8d90',
  },
});

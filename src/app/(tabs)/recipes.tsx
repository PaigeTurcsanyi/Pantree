import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton, Pill, ProductTile, SearchField } from '@/components/ui';
import { Radius, Shadows, Spacing } from '@/constants/theme';
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
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <ThemedText type="subtitle">Recipes</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Cook down your pantry before it wilts
          </ThemedText>
        </View>
        <IconButton
          icon="add"
          variant="accent"
          onPress={() => router.push('/recipe/add')}
          accessibilityLabel="Add a recipe"
        />
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search recipes" />

      <View style={styles.filterRow}>
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
            <Pill
              key={key}
              label={`${label} · ${count}`}
              active={filter === key}
              tone={key === 'ready' ? 'success' : 'default'}
              icon={key === 'ready' ? 'eco' : undefined}
              onPress={() => setFilter(key)}
            />
          );
        })}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(recipe) => String(recipe.id)}
        contentContainerStyle={visible.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <RecipeRow item={item} onPress={() => router.push(`/recipe/${item.id}`)} />
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

function RecipeRow({ item, onPress }: { item: Evaluated; onPress: () => void }) {
  const theme = useTheme();
  const tone = statusTone(item.check);
  const color =
    tone === 'ok' ? theme.success : tone === 'warn' ? theme.warn : theme.textMuted;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.row,
            { backgroundColor: theme.surface, borderColor: theme.hairline },
            pressed && styles.rowPressed,
          ]}>
          <ProductTile
            photoUrl={item.photo_url}
            name={item.title}
            style={styles.thumbnail}
            iconSize={28}
            radius={Radius.thumbnail}
          />
          <View style={styles.rowText}>
            <ThemedText type="cardTitle" numberOfLines={1}>
              {item.title}
            </ThemedText>
            {item.servings ? (
              <ThemedText type="meta" themeColor="textMuted">
                Serves {item.servings}
              </ThemedText>
            ) : null}
            <View style={styles.statusRow}>
              <Icon name="circle" size={11} color={color} />
              <ThemedText type="meta" style={[styles.statusText, { color }]} numberOfLines={1}>
                {statusLabel(item.check)}
              </ThemedText>
            </View>
          </View>
          <Icon name="chevron_right" size={20} color={theme.chevron} />
        </View>
      )}
    </Pressable>
  );
}

function statusTone(check: RecipeCheck | null): 'ok' | 'warn' | 'muted' {
  if (!check) return 'muted';
  if (check.canMake) return 'ok';
  if (check.canMakeWithSubstitutes || check.problems.length <= 2) return 'warn';
  return 'muted';
}

function statusLabel(check: RecipeCheck | null): string {
  if (!check) return 'No ingredients yet';
  if (check.canMake) return 'You have everything';
  if (check.canMakeWithSubstitutes) return 'Makeable with swaps';
  const missing = check.problems.map((p) => p.ingredient.name);
  if (missing.length <= 2) return `Need ${missing.join(' and ')}`;
  return `Missing ${missing.length} ingredients`;
}

function emptyMessage(filter: Filter, search: string): string {
  if (search) return `No recipes match “${search}”.`;
  if (filter === 'ready') return 'Nothing you can make right now. Check “Almost”.';
  if (filter === 'almost') return 'Nothing close by. Add a few pantry items.';
  return 'No recipes yet. Tap + to write one down, read a screenshot, or browse the starter recipes.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  list: {
    gap: Spacing.row,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
    paddingHorizontal: Spacing.four,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 12,
    gap: 14,
    ...Shadows.card,
  },
  rowPressed: {
    opacity: 0.85,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  thumbnail: {
    width: 60,
    height: 60,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  statusText: {
    flex: 1,
    fontWeight: '700',
  },
});

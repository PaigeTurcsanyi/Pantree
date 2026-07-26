import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { listRecipes, Recipe } from '@/db/recipes';
import { useTheme } from '@/hooks/use-theme';

export default function RecipesScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    listRecipes(db, search).then((rows) => {
      setRecipes(rows);
      setLoaded(true);
    });
  }, [db, search]);

  useEffect(refresh, [refresh]);
  useFocusEffect(refresh);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Recipes</ThemedText>
        <Pressable
          onPress={() => router.push('/recipe/edit/new')}
          style={[styles.addButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">+ Add recipe</ThemedText>
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

      <FlatList
        data={recipes}
        keyExtractor={(recipe) => String(recipe.id)}
        contentContainerStyle={recipes.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/recipe/${item.id}`)}>
            {({ pressed }) => (
              <ThemedView
                type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.row}>
                <ThemedText>{item.title}</ThemedText>
                {item.servings ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Serves {item.servings}
                  </ThemedText>
                ) : null}
              </ThemedView>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loaded ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {search
                ? `No recipes match “${search}”.`
                : 'No recipes yet. Tap “+ Add recipe” to write one down.'}
            </ThemedText>
          ) : null
        }
      />
    </ThemedView>
  );
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
    marginBottom: 12,
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
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 2,
  },
});

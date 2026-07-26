import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { checkIngredients, RecipeCheck } from '@/db/cooking';
import { listPantryItems } from '@/db/pantry';
import { getRecipe, listRecipes } from '@/db/recipes';
import { listSubstitutions } from '@/db/substitutions';

type Evaluated = {
  id: number;
  title: string;
  servings: number | null;
  check: RecipeCheck;
};

export default function WhatCanIMakeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [ready, setReady] = useState<Evaluated[]>([]);
  const [almost, setAlmost] = useState<Evaluated[]>([]);
  const [rest, setRest] = useState<Evaluated[]>([]);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    const [recipes, pantry, substitutions] = await Promise.all([
      listRecipes(db),
      listPantryItems(db),
      listSubstitutions(db),
    ]);

    const evaluated: Evaluated[] = [];
    for (const recipe of recipes) {
      const full = await getRecipe(db, recipe.id);
      if (!full || full.ingredients.length === 0) continue;
      evaluated.push({
        id: recipe.id,
        title: recipe.title,
        servings: recipe.servings,
        check: checkIngredients(full.ingredients, pantry, 1, substitutions),
      });
    }

    setReady(evaluated.filter((e) => e.check.canMake));
    setAlmost(
      evaluated.filter(
        (e) => !e.check.canMake && (e.check.canMakeWithSubstitutes || e.check.problems.length <= 2)
      )
    );
    setRest(
      evaluated.filter(
        (e) => !e.check.canMake && !e.check.canMakeWithSubstitutes && e.check.problems.length > 2
      )
    );
    setLoaded(true);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const total = ready.length + almost.length + rest.length;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedText type="subtitle">What can I make?</ThemedText>
      <ScrollView contentContainerStyle={styles.content}>
        {loaded && total === 0 && (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Add a recipe with ingredients and it’ll show up here.
          </ThemedText>
        )}

        {ready.length > 0 && (
          <Section title="Ready to cook">
            {ready.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                detail="You have everything."
                tone="ok"
                onPress={() => router.push(`/recipe/${item.id}`)}
              />
            ))}
          </Section>
        )}

        {almost.length > 0 && (
          <Section title="Almost there">
            {almost.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                detail={describeGaps(item.check)}
                tone="warn"
                onPress={() => router.push(`/recipe/${item.id}`)}
              />
            ))}
          </Section>
        )}

        {rest.length > 0 && (
          <Section title="Needs a shop">
            {rest.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                detail={`Missing ${item.check.problems.length} ingredients.`}
                tone="muted"
                onPress={() => router.push(`/recipe/${item.id}`)}
              />
            ))}
          </Section>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function describeGaps(check: RecipeCheck): string {
  const parts = check.problems.map((problem) => {
    const name = problem.ingredient.name;
    if (problem.substitutes.length > 0) {
      return `${name} → use ${problem.substitutes[0].item.name}`;
    }
    return problem.status === 'short' ? `${name} (running low)` : name;
  });
  return parts.join(', ');
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function RecipeCard({
  item,
  detail,
  tone,
  onPress,
}: {
  item: Evaluated;
  detail: string;
  tone: 'ok' | 'warn' | 'muted';
  onPress: () => void;
}) {
  const detailColor =
    tone === 'ok' ? styles.okText : tone === 'warn' ? styles.warnText : undefined;

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <ThemedView
          type={pressed ? 'backgroundSelected' : 'backgroundElement'}
          style={styles.card}>
          <ThemedText>{item.title}</ThemedText>
          <ThemedText
            type="small"
            themeColor={tone === 'muted' ? 'textSecondary' : undefined}
            style={detailColor}>
            {detail}
          </ThemedText>
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    paddingVertical: 12,
    paddingBottom: 32,
    gap: 20,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 40,
  },
  section: {
    gap: 8,
  },
  card: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 3,
  },
  okText: {
    color: '#30a46c',
  },
  warnText: {
    color: '#f5a524',
  },
});

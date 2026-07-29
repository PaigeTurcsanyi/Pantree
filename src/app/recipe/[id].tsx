import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ConfirmPanel } from '@/components/confirm-panel';
import { foodIconFor, Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton, Pill } from '@/components/ui';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import {
  checkIngredients,
  deductRecipe,
  IngredientCheck,
  RecipeCheck,
  suggestScale,
} from '@/db/cooking';
import { formatQuantity, listPantryItems } from '@/db/pantry';
import {
  deleteRecipe,
  getRecipe,
  RecipeWithIngredients,
  setRecipeFavorite,
  updateRecipe,
} from '@/db/recipes';
import { starterImageFor } from '@/data/starter-recipes';
import { listSubstitutions } from '@/db/substitutions';
import { useTheme } from '@/hooks/use-theme';

const HERO_HEIGHT = 224;

export default function RecipeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipeId = Number(id);
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

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

  const fitScale = check && scale === 1 ? suggestScale(check) : null;

  // Your own photo wins; otherwise fall back to the bundled starter art.
  const heroSource = recipe?.photo_url ?? (recipe ? starterImageFor(recipe.title) : undefined);

  const leaveScreen = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/recipes');
  };

  const doDelete = async () => {
    await deleteRecipe(db, recipeId);
    leaveScreen();
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

  const toggleFavorite = async () => {
    if (!recipe) return;
    await setRecipeFavorite(db, recipeId, !recipe.is_favorite);
    await load(scale);
  };

  const changePhoto = async () => {
    if (!recipe) return;
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled) return;
    await updateRecipe(db, recipeId, {
      title: recipe.title,
      servings: recipe.servings,
      steps: recipe.steps,
      notes: recipe.notes,
      photo_url: picked.assets[0].uri,
      ingredients: recipe.ingredients.map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
      })),
    });
    await load(scale);
  };

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
        <Stack.Screen options={{ headerShown: true, title: 'Recipe' }} />
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
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[theme.heroTop, theme.heroBottom]}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}>
          {heroSource ? (
            <Image source={heroSource} style={styles.heroImage} contentFit="cover" />
          ) : (
            <Icon name={foodIconFor(recipe.title)} size={74} color="rgba(246,241,231,0.28)" />
          )}

          <View style={[styles.heroBar, { paddingTop: insets.top + 10 }]}>
            <IconButton
              icon="arrow_back"
              variant="translucent"
              size={38}
              onPress={leaveScreen}
              accessibilityLabel="Go back"
            />
            <View style={styles.heroActions}>
              <IconButton
                icon={recipe.is_favorite ? 'favorite_filled' : 'favorite'}
                variant="translucent"
                size={38}
                onPress={toggleFavorite}
                accessibilityLabel={
                  recipe.is_favorite ? 'Remove from favourites' : 'Add to favourites'
                }
              />
              <IconButton
                icon="add_a_photo"
                variant="translucent"
                size={38}
                onPress={changePhoto}
                accessibilityLabel="Change recipe photo"
              />
            </View>
          </View>
        </LinearGradient>

        <View style={[styles.sheet, { backgroundColor: theme.background }]}>
          <ThemedText type="displaySmall">{recipe.title}</ThemedText>

          {recipe.servings ? (
            <View style={styles.metaRow}>
              <Icon name="restaurant" size={15} color={theme.textSecondary} />
              <ThemedText type="meta" themeColor="textSecondary">
                Serves {formatNumber(recipe.servings * scale)}
                {scale !== 1 ? ` at ${formatNumber(scale)}×` : ''}
              </ThemedText>
            </View>
          ) : null}

          {check && <MakeStatus check={check} />}

          {fitScale !== null && (
            <Pressable onPress={() => applyScale(fitScale)}>
              <View
                style={[
                  styles.fitBanner,
                  { backgroundColor: theme.warnSoft, borderColor: theme.warnSoftBorder },
                ]}>
                <Icon name="nutrition" size={24} color={theme.warn} />
                <View style={styles.fitText}>
                  <ThemedText type="meta" style={[styles.fitTitle, { color: theme.warnText }]}>
                    You’re short — scale to {formatNumber(fitScale)}×?
                  </ThemedText>
                  <ThemedText type="meta" style={{ color: theme.warnTextSoft }}>
                    Every amount recalculates so the ratios stay right.
                  </ThemedText>
                </View>
                <View style={[styles.scaleAction, { backgroundColor: theme.warn }]}>
                  <ThemedText type="chip" style={styles.scaleActionText}>
                    Scale
                  </ThemedText>
                </View>
              </View>
            </Pressable>
          )}

          <View style={styles.sectionHeader}>
            <ThemedText type="sectionLabel" themeColor="textMuted">
              Ingredients
            </ThemedText>
            <View style={styles.batchRow}>
              <ThemedText type="meta" themeColor="textSecondary">
                Batch
              </ThemedText>
              {[0.5, 1, 2].map((option) => (
                <Pill
                  key={option}
                  label={`${formatNumber(option)}×`}
                  active={scale === option}
                  onPress={() => applyScale(option)}
                />
              ))}
              {scale !== 1 && ![0.5, 2].includes(scale) && (
                <Pill label={`${formatNumber(scale)}×`} active />
              )}
            </View>
          </View>

          {recipe.ingredients.length === 0 ? (
            <ThemedText type="meta" themeColor="textMuted">
              No ingredients listed.
            </ThemedText>
          ) : (
            <View
              style={[
                styles.card,
                { backgroundColor: theme.surface, borderColor: theme.hairline },
              ]}>
              {(check?.checks ?? []).map((item, index) => (
                <IngredientRow key={item.ingredient.id} check={item} first={index === 0} />
              ))}
            </View>
          )}

          {recipe.steps.length > 0 && (
            <>
              <ThemedText
                type="sectionLabel"
                themeColor="textMuted"
                style={styles.sectionSpacing}>
                Method
              </ThemedText>
              <View style={styles.steps}>
                {recipe.steps.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <View style={[styles.stepChip, { backgroundColor: theme.successSoft }]}>
                      <ThemedText type="badge" style={{ color: theme.accent }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.stepText}>{step}</ThemedText>
                  </View>
                ))}
              </View>
            </>
          )}

          {recipe.notes ? (
            <>
              <ThemedText
                type="sectionLabel"
                themeColor="textMuted"
                style={styles.sectionSpacing}>
                Notes
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {recipe.notes}
              </ThemedText>
            </>
          ) : null}

          {madeMessage ? (
            <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionSpacing}>
              {madeMessage}
            </ThemedText>
          ) : null}

          {confirming === 'made' && (
            <ConfirmPanel
              message={deductionPreview()}
              confirmLabel="Deduct"
              onConfirm={() => void doDeduct()}
              onCancel={() => setConfirming(null)}
            />
          )}

          {confirming === 'delete' && (
            <ConfirmPanel
              message={`Delete “${recipe.title}”?`}
              confirmLabel="Delete"
              destructive
              onConfirm={() => void doDelete()}
              onCancel={() => setConfirming(null)}
            />
          )}

          {recipe.ingredients.length > 0 && confirming !== 'made' && (
            <Pressable onPress={() => setConfirming('made')} style={styles.primaryWrap}>
              <View style={[styles.primaryButton, { backgroundColor: theme.accent }]}>
                <Icon name="restaurant_menu" size={19} color={theme.accentText} />
                <ThemedText type="cardTitle" style={{ color: theme.accentText }}>
                  {scale === 1
                    ? 'I made this — deduct from pantry'
                    : `I made this (${formatNumber(scale)}× batch)`}
                </ThemedText>
              </View>
            </Pressable>
          )}

          <View style={styles.secondaryRow}>
            <Pressable
              onPress={() => router.push(`/recipe/edit/${recipe.id}`)}
              style={styles.secondaryWrap}>
              <View
                style={[
                  styles.secondaryButton,
                  { backgroundColor: theme.surface, borderColor: theme.hairline },
                ]}>
                <ThemedText type="chip">Edit recipe</ThemedText>
              </View>
            </Pressable>
            {confirming !== 'delete' && (
              <Pressable onPress={() => setConfirming('delete')} style={styles.secondaryWrap}>
                <View
                  style={[
                    styles.secondaryButton,
                    { backgroundColor: theme.surface, borderColor: theme.hairline },
                  ]}>
                  <ThemedText type="chip" style={{ color: theme.danger }}>
                    Delete recipe
                  </ThemedText>
                </View>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

function formatNumber(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function MakeStatus({ check }: { check: RecipeCheck }) {
  const theme = useTheme();

  if (check.canMake) {
    return (
      <View style={styles.statusRow}>
        <Icon name="circle" size={12} color={theme.success} />
        <ThemedText type="meta" style={[styles.statusText, { color: theme.success }]}>
          You have everything for this
        </ThemedText>
      </View>
    );
  }

  const missing = check.problems.filter((p) => p.status === 'missing');
  const short = check.problems.filter((p) => p.status === 'short');

  return (
    <View style={styles.statusBlock}>
      <View style={styles.statusRow}>
        <Icon name="circle" size={12} color={theme.warn} />
        <ThemedText type="meta" style={[styles.statusText, { color: theme.warn }]}>
          {missing.length > 0 && `Missing ${missing.map((p) => p.ingredient.name).join(', ')}`}
          {missing.length > 0 && short.length > 0 && ' · '}
          {short.length > 0 && `Short on ${short.map((p) => p.ingredient.name).join(', ')}`}
        </ThemedText>
      </View>
      {check.canMakeWithSubstitutes && (
        <ThemedText type="meta" themeColor="textSecondary">
          You can still make this using the swaps below.
        </ThemedText>
      )}
    </View>
  );
}

function IngredientRow({ check, first }: { check: IngredientCheck; first: boolean }) {
  const theme = useTheme();
  const { ingredient, match, status, needed, available, substitutes } = check;
  const short = status !== 'enough';
  const swap = substitutes[0];

  return (
    <View style={[styles.ingredientBlock, !first && { borderTopColor: theme.hairline }]}>
      <View style={styles.ingredientRow}>
        <View style={styles.ingredientText}>
          <ThemedText type="small" style={styles.ingredientName}>
            {ingredient.name}
          </ThemedText>
          <ThemedText type="meta" style={{ color: short ? theme.warn : theme.textMuted }}>
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
        </View>
        <ThemedText
          type="small"
          style={[styles.ingredientAmount, { color: short ? theme.warn : theme.text }]}>
          {formatQuantity(needed, ingredient.unit)}
        </ThemedText>
      </View>

      {swap && (
        <View style={[styles.substitute, { borderLeftColor: theme.warn }]}>
          <ThemedText type="meta" style={{ color: theme.warn, fontWeight: '700' }}>
            Swap: {formatQuantity(swap.amount, swap.unit)}
            {swap.unit === 'each' ? ` × ${swap.item.name}` : ` ${swap.item.name}`}
          </ThemedText>
          {swap.substitution.notes ? (
            <ThemedText type="meta" themeColor="textMuted">
              {swap.substitution.notes}
            </ThemedText>
          ) : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingBottom: Spacing.five,
  },
  missing: {
    textAlign: 'center',
    padding: Spacing.five,
  },
  hero: {
    height: HERO_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.screen,
  },
  heroActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  sheet: {
    marginTop: -24,
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    paddingHorizontal: Spacing.screen,
    paddingTop: Spacing.four,
    gap: Spacing.two,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBlock: {
    gap: 2,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusText: {
    flex: 1,
    fontWeight: '700',
  },
  fitBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderWidth: 1,
    borderRadius: Radius.button,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: Spacing.two,
  },
  fitText: {
    flex: 1,
    gap: 1,
  },
  fitTitle: {
    fontWeight: '700',
  },
  scaleAction: {
    borderRadius: Radius.pill,
    paddingVertical: 9,
    paddingHorizontal: 18,
  },
  scaleActionText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  batchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionSpacing: {
    marginTop: Spacing.four,
  },
  card: {
    borderRadius: Radius.button,
    borderWidth: 1,
    paddingHorizontal: 14,
    ...Shadows.card,
  },
  ingredientBlock: {
    paddingVertical: 12,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'transparent',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  ingredientText: {
    flex: 1,
    gap: 1,
  },
  ingredientName: {
    fontWeight: '600',
    fontSize: 14.5,
  },
  ingredientAmount: {
    fontWeight: '700',
  },
  substitute: {
    borderLeftWidth: 2,
    paddingLeft: 10,
    gap: 1,
  },
  steps: {
    gap: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.stepChip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    lineHeight: 21,
  },
  primaryWrap: {
    marginTop: Spacing.four,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Radius.button,
    paddingVertical: 16,
    ...Shadows.button,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  secondaryWrap: {
    flex: 1,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: Radius.button,
    paddingVertical: 13,
    alignItems: 'center',
  },
});

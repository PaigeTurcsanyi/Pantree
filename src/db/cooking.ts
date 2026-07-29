import type { SQLiteDatabase } from 'expo-sqlite';

import type { PantryItem, PantryUnit } from '@/db/pantry';
import type { RecipeIngredient } from '@/db/recipes';
import { matchScore, NAME_CONTAINMENT_SCORE } from '@/lib/name-match';

export { matchScore, NAME_CONTAINMENT_SCORE };

export type IngredientStatus = 'enough' | 'short' | 'missing';

export type Substitution = {
  id: number;
  ingredient: string;
  substitute: string;
  ratio: number;
  notes: string | null;
  /** Unit of the substitute when it differs from the ingredient's. */
  substitute_unit: PantryUnit | null;
};

/** A substitute you actually have enough of on hand. */
export type SubstituteOption = {
  substitution: Substitution;
  item: PantryItem;
  /** How much of the substitute this recipe would need. */
  amount: number;
  /** Unit that amount is measured in — not always the ingredient's. */
  unit: PantryUnit;
};

export type IngredientCheck = {
  ingredient: RecipeIngredient;
  /** Pantry item this ingredient was matched to, if any. */
  match: PantryItem | null;
  status: IngredientStatus;
  /** How much is needed at the current scale, in the ingredient's unit. */
  needed: number;
  /** How much the matched pantry item holds (0 when unmatched). */
  available: number;
  /** Largest recipe multiple this ingredient alone supports (Infinity if free). */
  maxScale: number;
  /** Usable substitutes for the shortfall, best first. */
  substitutes: SubstituteOption[];
};

export type RecipeCheck = {
  checks: IngredientCheck[];
  canMake: boolean;
  /** Missing or short ingredients — what stands between you and dinner. */
  problems: IngredientCheck[];
  /** Problems that a substitute in your pantry could cover. */
  coveredBySubstitute: IngredientCheck[];
  /** True when every gap has a usable substitute. */
  canMakeWithSubstitutes: boolean;
  /** Largest scale the whole pantry supports, capped at the requested scale. */
  maxScale: number;
};

/**
 * Pantry stores g/ml/each as base units, so a unit is compatible only with
 * itself. Density conversion (g <-> ml) needs per-ingredient data we don't have.
 */
function unitsCompatible(a: PantryUnit, b: PantryUnit): boolean {
  return a === b;
}

export function findMatch(ingredient: RecipeIngredient, pantry: PantryItem[]): PantryItem | null {
  let best: PantryItem | null = null;
  let bestScore = 0;
  for (const item of pantry) {
    if (!unitsCompatible(ingredient.unit, item.unit)) continue;
    // Require one name to contain the other. A single shared word is not
    // enough: "frozen peas" and "frozen fruit mango" are not the same thing,
    // and a wrong match here silently deducts from the wrong item.
    const score = matchScore(ingredient.name, item.name);
    if (score >= NAME_CONTAINMENT_SCORE && score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Substitutes that cover the shortfall for an ingredient. Only substitutes
 * you hold enough of are offered — a suggestion you can't act on is noise.
 */
export function findSubstitutes(
  ingredientName: string,
  shortfall: number,
  unit: PantryUnit,
  pantry: PantryItem[],
  substitutions: Substitution[],
  /** The pantry item already supplying this ingredient, if any. */
  excludeItemId?: number
): SubstituteOption[] {
  if (shortfall <= 0) return [];

  const options: SubstituteOption[] = [];
  for (const substitution of substitutions) {
    if (matchScore(ingredientName, substitution.ingredient) < NAME_CONTAINMENT_SCORE) continue;

    // A substitute is usually measured like the ingredient, but not always:
    // whole lemons replace lemon juice, counted rather than poured.
    const substituteUnit = substitution.substitute_unit ?? unit;
    const rawAmount = shortfall * substitution.ratio;
    // Counted things can't be split — half a lemon won't do if you need one.
    const amount =
      substituteUnit === 'each' ? Math.ceil(rawAmount - 1e-9) : round(rawAmount);
    if (amount <= 0) continue;

    let best: PantryItem | null = null;
    let bestScore = 0;
    for (const item of pantry) {
      // Never offer the item that's already covering this ingredient —
      // "substitute flour with flour" is noise.
      if (item.id === excludeItemId) continue;
      if (item.unit !== substituteUnit) continue;
      if (item.quantity + 1e-9 < amount) continue;
      // Require a solid name match; loose token overlap pairs unrelated
      // products like "bread flour" with "all-purpose flour".
      const score = matchScore(substitution.substitute, item.name);
      if (score >= NAME_CONTAINMENT_SCORE && score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    if (best) options.push({ substitution, item: best, amount, unit: substituteUnit });
  }
  return options;
}

export function checkIngredients(
  ingredients: RecipeIngredient[],
  pantry: PantryItem[],
  scale = 1,
  substitutions: Substitution[] = []
): RecipeCheck {
  const checks: IngredientCheck[] = ingredients.map((ingredient) => {
    const match = findMatch(ingredient, pantry);
    const needed = round(ingredient.amount * scale);
    const available = match?.quantity ?? 0;
    const perBatch = ingredient.amount;

    let status: IngredientStatus;
    if (!match) status = 'missing';
    else if (available + 1e-9 >= needed) status = 'enough';
    else status = 'short';

    const substitutes =
      status === 'enough'
        ? []
        : findSubstitutes(
            ingredient.name,
            needed - available,
            ingredient.unit,
            pantry,
            substitutions,
            match?.id
          );

    return {
      ingredient,
      match,
      status,
      needed,
      available,
      maxScale: perBatch > 0 ? available / perBatch : Number.POSITIVE_INFINITY,
      substitutes,
    };
  });

  const problems = checks.filter((check) => check.status !== 'enough');
  const coveredBySubstitute = problems.filter((check) => check.substitutes.length > 0);
  const maxScale = checks.reduce(
    (lowest, check) => Math.min(lowest, check.maxScale),
    Number.POSITIVE_INFINITY
  );

  return {
    checks,
    canMake: problems.length === 0,
    problems,
    coveredBySubstitute,
    canMakeWithSubstitutes:
      problems.length > 0 && coveredBySubstitute.length === problems.length,
    maxScale,
  };
}

/**
 * Largest batch the pantry supports, rounded down to a usable fraction.
 * Returns null when scaling can't rescue the recipe — either you already
 * have enough, or something is missing outright and no smaller batch helps.
 */
export function suggestScale(check: RecipeCheck): number | null {
  if (check.canMake) return null;
  // A missing ingredient stays missing at any scale.
  if (check.problems.some((problem) => problem.status === 'missing')) return null;

  const fitted = Math.floor(check.maxScale * 100) / 100;
  if (!Number.isFinite(fitted) || fitted <= 0 || fitted >= 1) return null;
  return fitted;
}

/**
 * Subtract a cooked recipe from the pantry. Only matched ingredients are
 * deducted; quantities floor at 0 so a slight over-use can't go negative.
 */
export async function deductRecipe(
  db: SQLiteDatabase,
  checks: IngredientCheck[]
): Promise<{ deducted: number; skipped: number }> {
  let deducted = 0;
  let skipped = 0;

  await db.withTransactionAsync(async () => {
    for (const check of checks) {
      if (!check.match) {
        skipped += 1;
        continue;
      }
      const remaining = round(Math.max(0, check.match.quantity - check.needed));
      await db.runAsync(
        `UPDATE pantry_items SET quantity = ?, updated_at = datetime('now') WHERE id = ?`,
        remaining,
        check.match.id
      );
      deducted += 1;
    }
  });

  return { deducted, skipped };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

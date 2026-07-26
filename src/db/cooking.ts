import type { SQLiteDatabase } from 'expo-sqlite';

import type { PantryItem, PantryUnit } from '@/db/pantry';
import type { RecipeIngredient } from '@/db/recipes';

export type IngredientStatus = 'enough' | 'short' | 'missing';

export type Substitution = {
  id: number;
  ingredient: string;
  substitute: string;
  ratio: number;
  notes: string | null;
};

/** A substitute you actually have enough of on hand. */
export type SubstituteOption = {
  substitution: Substitution;
  item: PantryItem;
  /** How much of the substitute this recipe would need. */
  amount: number;
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

/** Loose name matching: "All-purpose flour" in the pantry covers "flour" in a recipe. */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function singularize(word: string): string {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (word.endsWith('es') && word.length > 3) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1);
  return word;
}

function nameTokens(name: string): string[] {
  return normalizeName(name).split(' ').filter(Boolean).map(singularize);
}

/**
 * Score how well a pantry item matches an ingredient name.
 * 0 means no match; higher is better.
 */
export function matchScore(ingredientName: string, pantryName: string): number {
  const a = nameTokens(ingredientName);
  const b = nameTokens(pantryName);
  if (a.length === 0 || b.length === 0) return 0;

  const aSet = new Set(a);
  const bSet = new Set(b);
  const shared = [...aSet].filter((token) => bSet.has(token));
  if (shared.length === 0) return 0;

  const joinedA = a.join(' ');
  const joinedB = b.join(' ');
  if (joinedA === joinedB) return 1000;
  if (joinedB.includes(joinedA) || joinedA.includes(joinedB)) return 500 + shared.length;
  // Partial overlap: prefer matches that cover more of the ingredient name.
  return Math.round((shared.length / aSet.size) * 100) + shared.length;
}

export function findMatch(ingredient: RecipeIngredient, pantry: PantryItem[]): PantryItem | null {
  let best: PantryItem | null = null;
  let bestScore = 0;
  for (const item of pantry) {
    if (!unitsCompatible(ingredient.unit, item.unit)) continue;
    const score = matchScore(ingredient.name, item.name);
    if (score > bestScore) {
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
  substitutions: Substitution[]
): SubstituteOption[] {
  if (shortfall <= 0) return [];

  const options: SubstituteOption[] = [];
  for (const substitution of substitutions) {
    if (matchScore(ingredientName, substitution.ingredient) === 0) continue;

    const amount = round(shortfall * substitution.ratio);
    let best: PantryItem | null = null;
    let bestScore = 0;
    for (const item of pantry) {
      if (item.unit !== unit) continue;
      if (item.quantity + 1e-9 < amount) continue;
      const score = matchScore(substitution.substitute, item.name);
      if (score > bestScore) {
        best = item;
        bestScore = score;
      }
    }
    if (best) options.push({ substitution, item: best, amount });
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
        : findSubstitutes(ingredient.name, needed - available, ingredient.unit, pantry, substitutions);

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

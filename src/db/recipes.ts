import type { SQLiteDatabase } from 'expo-sqlite';

import type { PantryUnit } from '@/db/pantry';

export type RecipeSource = 'typed' | 'screenshot';

export type Recipe = {
  id: number;
  title: string;
  source: RecipeSource;
  servings: number | null;
  /** Stored as a JSON array of strings in SQLite. */
  steps: string;
  notes: string | null;
};

export type RecipeIngredient = {
  id: number;
  recipe_id: number;
  name: string;
  amount: number;
  unit: PantryUnit;
  pantry_item_id: number | null;
};

export type RecipeWithIngredients = Omit<Recipe, 'steps'> & {
  steps: string[];
  ingredients: RecipeIngredient[];
};

export type RecipeIngredientInput = {
  name: string;
  amount: number;
  unit: PantryUnit;
};

export type RecipeInput = {
  title: string;
  servings: number | null;
  steps: string[];
  notes?: string | null;
  source?: RecipeSource;
  ingredients: RecipeIngredientInput[];
};

export async function listRecipes(db: SQLiteDatabase, search = ''): Promise<Recipe[]> {
  const term = search.trim();
  if (term) {
    return db.getAllAsync<Recipe>(
      `SELECT * FROM recipes WHERE title LIKE '%' || ? || '%' ORDER BY title COLLATE NOCASE`,
      term
    );
  }
  return db.getAllAsync<Recipe>('SELECT * FROM recipes ORDER BY title COLLATE NOCASE');
}

export async function getRecipe(
  db: SQLiteDatabase,
  id: number
): Promise<RecipeWithIngredients | null> {
  const recipe = await db.getFirstAsync<Recipe>('SELECT * FROM recipes WHERE id = ?', id);
  if (!recipe) return null;
  const ingredients = await db.getAllAsync<RecipeIngredient>(
    'SELECT * FROM recipe_ingredients WHERE recipe_id = ? ORDER BY id',
    id
  );
  return { ...recipe, steps: parseSteps(recipe.steps), ingredients };
}

export async function insertRecipe(db: SQLiteDatabase, input: RecipeInput): Promise<number> {
  let recipeId = 0;
  await db.withTransactionAsync(async () => {
    const result = await db.runAsync(
      'INSERT INTO recipes (title, source, servings, steps, notes) VALUES (?, ?, ?, ?, ?)',
      input.title.trim(),
      input.source ?? 'typed',
      input.servings,
      JSON.stringify(input.steps),
      input.notes?.trim() || null
    );
    recipeId = result.lastInsertRowId;
    await insertIngredients(db, recipeId, input.ingredients);
  });
  return recipeId;
}

export async function updateRecipe(
  db: SQLiteDatabase,
  id: number,
  input: RecipeInput
): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      'UPDATE recipes SET title = ?, servings = ?, steps = ?, notes = ? WHERE id = ?',
      input.title.trim(),
      input.servings,
      JSON.stringify(input.steps),
      input.notes?.trim() || null,
      id
    );
    await db.runAsync('DELETE FROM recipe_ingredients WHERE recipe_id = ?', id);
    await insertIngredients(db, id, input.ingredients);
  });
}

export async function deleteRecipe(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM recipe_ingredients WHERE recipe_id = ?', id);
  await db.runAsync('DELETE FROM recipes WHERE id = ?', id);
}

async function insertIngredients(
  db: SQLiteDatabase,
  recipeId: number,
  ingredients: RecipeIngredientInput[]
) {
  for (const ingredient of ingredients) {
    if (!ingredient.name.trim()) continue;
    await db.runAsync(
      'INSERT INTO recipe_ingredients (recipe_id, name, amount, unit) VALUES (?, ?, ?, ?)',
      recipeId,
      ingredient.name.trim(),
      ingredient.amount,
      ingredient.unit
    );
  }
}

function parseSteps(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'pantree.db';

/**
 * Bump this and add a migration step below whenever the schema changes.
 * Existing installs migrate forward from whatever version they're on.
 */
const SCHEMA_VERSION = 4;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = result?.user_version ?? 0;

  if (version === 0) {
    // Amounts are stored in a normalized base unit: grams for mass,
    // ml for volume, "each" for count. Display formatting happens in the UI.
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS pantry_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        brand TEXT,
        photo_url TEXT,
        quantity REAL NOT NULL DEFAULT 0,
        unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'each')),
        category TEXT,
        barcode TEXT,
        off_id TEXT,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS recipes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        source TEXT NOT NULL DEFAULT 'typed' CHECK (source IN ('typed', 'screenshot')),
        servings REAL,
        steps TEXT NOT NULL DEFAULT '[]',
        notes TEXT
      );

      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        amount REAL NOT NULL,
        unit TEXT NOT NULL CHECK (unit IN ('g', 'ml', 'each')),
        pantry_item_id INTEGER REFERENCES pantry_items(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS substitutions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ingredient TEXT NOT NULL,
        substitute TEXT NOT NULL,
        ratio REAL NOT NULL DEFAULT 1,
        notes TEXT
      );
    `);
    version = 1;
  }

  if (version === 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
    version = 2;
  }

  if (version === 2) {
    await seedSubstitutions(db);
    version = 3;
  }

  if (version === 3) {
    version = 4;
  }

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);

  // Added columns are applied here rather than in a version step. A
  // user_version that runs ahead of the actual schema (an interrupted
  // migration, a restored database) would otherwise skip them forever,
  // and every INSERT would fail on the missing column.
  await addColumnIfMissing(db, 'pantry_items', 'nutrition', 'TEXT');
  await addColumnIfMissing(db, 'recipes', 'photo_url', 'TEXT');
}

async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  column: string,
  definition: string
) {
  const columns = await db.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
  if (columns.some((c) => c.name === column)) return;
  await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Starter substitution list. `ratio` is how much substitute replaces one
 * unit of the original, so 1 g butter -> 0.75 g oil.
 */
const STARTER_SUBSTITUTIONS: [string, string, number, string][] = [
  ['butter', 'oil', 0.75, 'Use ¾ as much oil. Best in cakes and quick breads.'],
  ['oil', 'butter', 1.25, 'Melt the butter first.'],
  ['butter', 'margarine', 1, 'Swaps one-for-one.'],
  ['buttermilk', 'milk', 1, 'Add 1 tbsp lemon juice or vinegar per cup and rest 5 min.'],
  ['buttermilk', 'yogurt', 1, 'Thin plain yogurt with a splash of milk.'],
  ['milk', 'water', 1, 'Works in a pinch; the result is less rich.'],
  ['heavy cream', 'milk', 1, 'Add 2 tbsp melted butter per cup for richness.'],
  ['sour cream', 'yogurt', 1, 'Plain Greek yogurt is the closest match.'],
  ['egg', 'flax seed', 7, 'Flax egg: 7 g ground flax + 45 ml water per egg, rest 5 min.'],
  ['egg', 'apple sauce', 60, 'About 60 g apple sauce per egg. Best in sweet bakes.'],
  ['white sugar', 'brown sugar', 1, 'Swaps one-for-one; adds a light molasses note.'],
  ['brown sugar', 'white sugar', 1, 'Add 1 tsp molasses per 100 g if you have it.'],
  ['honey', 'maple syrup', 1, 'Swaps one-for-one.'],
  ['maple syrup', 'honey', 1, 'Swaps one-for-one.'],
  ['all-purpose flour', 'bread flour', 1, 'Slightly chewier result.'],
  ['bread flour', 'all-purpose flour', 1, 'Slightly softer result.'],
  ['baking powder', 'baking soda', 0.25, 'Use ¼ as much soda plus an acid like lemon juice.'],
  ['cornstarch', 'flour', 2, 'Use twice as much flour to thicken.'],
  ['lemon juice', 'vinegar', 1, 'White or cider vinegar works for acidity.'],
  ['vinegar', 'lemon juice', 1, 'Swaps one-for-one for acidity.'],
  ['garlic', 'garlic powder', 0.25, 'About ⅛ tsp powder per clove.'],
  ['onion', 'onion powder', 0.1, 'Use sparingly; powder is much stronger.'],
];

async function seedSubstitutions(db: SQLiteDatabase) {
  const existing = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM substitutions'
  );
  if ((existing?.count ?? 0) > 0) return;

  for (const [ingredient, substitute, ratio, notes] of STARTER_SUBSTITUTIONS) {
    await db.runAsync(
      'INSERT INTO substitutions (ingredient, substitute, ratio, notes) VALUES (?, ?, ?, ?)',
      ingredient,
      substitute,
      ratio,
      notes
    );
  }
}

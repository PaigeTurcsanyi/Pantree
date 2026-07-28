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
  await addColumnIfMissing(db, 'substitutions', 'substitute_unit', 'TEXT');
  // What the item held when it was last stocked, so the level bar can show
  // how much is left rather than just a raw number.
  await addColumnIfMissing(db, 'pantry_items', 'original_quantity', 'REAL');
  await db.execAsync(
    'UPDATE pantry_items SET original_quantity = quantity WHERE original_quantity IS NULL'
  );

  // Runs after the column exists, and tops up rows added in later versions.
  await seedSubstitutions(db);
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

type SeedSubstitution = {
  ingredient: string;
  substitute: string;
  /** How much substitute replaces one unit of the ingredient. */
  ratio: number;
  notes: string;
  /**
   * Unit the substitute is measured in, when it differs from the
   * ingredient's. Lets whole fruit stand in for its juice.
   */
  substituteUnit?: 'g' | 'ml' | 'each';
};

/** `ratio` is per one unit of the ingredient, so 1 g butter -> 0.75 g oil. */
const STARTER_SUBSTITUTIONS: SeedSubstitution[] = [
  { ingredient: 'butter', substitute: 'oil', ratio: 0.75, notes: 'Use ¾ as much oil. Best in cakes and quick breads.' },
  { ingredient: 'oil', substitute: 'butter', ratio: 1.25, notes: 'Melt the butter first.' },
  { ingredient: 'butter', substitute: 'margarine', ratio: 1, notes: 'Swaps one-for-one.' },
  { ingredient: 'buttermilk', substitute: 'milk', ratio: 1, notes: 'Add 1 tbsp lemon juice or vinegar per cup and rest 5 min.' },
  { ingredient: 'buttermilk', substitute: 'yogurt', ratio: 1, notes: 'Thin plain yogurt with a splash of milk.' },
  { ingredient: 'milk', substitute: 'water', ratio: 1, notes: 'Works in a pinch; the result is less rich.' },
  { ingredient: 'heavy cream', substitute: 'milk', ratio: 1, notes: 'Add 2 tbsp melted butter per cup for richness.' },
  { ingredient: 'sour cream', substitute: 'yogurt', ratio: 1, notes: 'Plain Greek yogurt is the closest match.' },
  { ingredient: 'egg', substitute: 'flax seed', ratio: 7, notes: 'Flax egg: 7 g ground flax + 45 ml water per egg, rest 5 min.', substituteUnit: 'g' },
  { ingredient: 'egg', substitute: 'apple sauce', ratio: 60, notes: 'About 60 g apple sauce per egg. Best in sweet bakes.', substituteUnit: 'g' },
  { ingredient: 'white sugar', substitute: 'brown sugar', ratio: 1, notes: 'Swaps one-for-one; adds a light molasses note.' },
  { ingredient: 'brown sugar', substitute: 'white sugar', ratio: 1, notes: 'Add 1 tsp molasses per 100 g if you have it.' },
  { ingredient: 'honey', substitute: 'maple syrup', ratio: 1, notes: 'Swaps one-for-one.' },
  { ingredient: 'maple syrup', substitute: 'honey', ratio: 1, notes: 'Swaps one-for-one.' },
  { ingredient: 'all-purpose flour', substitute: 'bread flour', ratio: 1, notes: 'Slightly chewier result.' },
  { ingredient: 'bread flour', substitute: 'all-purpose flour', ratio: 1, notes: 'Slightly softer result.' },
  { ingredient: 'baking powder', substitute: 'baking soda', ratio: 0.25, notes: 'Use ¼ as much soda plus an acid like lemon juice.' },
  { ingredient: 'cornstarch', substitute: 'flour', ratio: 2, notes: 'Use twice as much flour to thicken.' },
  { ingredient: 'lemon juice', substitute: 'vinegar', ratio: 1, notes: 'White or cider vinegar works for acidity.' },
  { ingredient: 'vinegar', substitute: 'lemon juice', ratio: 1, notes: 'Swaps one-for-one for acidity.' },
  { ingredient: 'garlic powder', substitute: 'garlic', ratio: 4, notes: 'Roughly 1 clove per ⅛ tsp of powder.', substituteUnit: 'each' },

  // Whole fruit standing in for its juice. Ratios are millilitres of juice
  // per fruit: a lemon gives about 45 ml, a lime 30, an orange 70.
  { ingredient: 'lemon juice', substitute: 'lemon', ratio: 1 / 45, notes: 'One lemon yields about 45 ml of juice. Roll it firmly before squeezing.', substituteUnit: 'each' },
  { ingredient: 'lime juice', substitute: 'lime', ratio: 1 / 30, notes: 'One lime yields about 30 ml of juice.', substituteUnit: 'each' },
  { ingredient: 'orange juice', substitute: 'orange', ratio: 1 / 70, notes: 'One orange yields about 70 ml of juice.', substituteUnit: 'each' },
  { ingredient: 'lemon zest', substitute: 'lemon', ratio: 1 / 6, notes: 'One lemon gives about 6 g of zest. Zest before juicing.', substituteUnit: 'each' },
];

/**
 * Inserts any starter substitution that isn't already present. Runs on every
 * launch rather than only on a fresh database, so pantries created before a
 * row existed still pick it up.
 */
async function seedSubstitutions(db: SQLiteDatabase) {
  for (const { ingredient, substitute, ratio, notes, substituteUnit } of STARTER_SUBSTITUTIONS) {
    const existing = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM substitutions WHERE ingredient = ? AND substitute = ?',
      ingredient,
      substitute
    );
    if (existing) continue;
    await db.runAsync(
      'INSERT INTO substitutions (ingredient, substitute, ratio, notes, substitute_unit) VALUES (?, ?, ?, ?, ?)',
      ingredient,
      substitute,
      ratio,
      notes,
      substituteUnit ?? null
    );
  }
}

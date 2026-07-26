import type { SQLiteDatabase } from 'expo-sqlite';

export const DATABASE_NAME = 'pantree.db';

/**
 * Bump this and add a migration step below whenever the schema changes.
 * Existing installs migrate forward from whatever version they're on.
 */
const SCHEMA_VERSION = 2;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = result?.user_version ?? 0;

  if (version >= SCHEMA_VERSION) return;

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

  await db.execAsync(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

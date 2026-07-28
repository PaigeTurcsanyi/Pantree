import type { SQLiteDatabase } from 'expo-sqlite';

import type { Nutrition } from '@/api/openfoodfacts';
import { matchScore, NAME_CONTAINMENT_SCORE } from '@/lib/name-match';

export type PantryUnit = 'g' | 'ml' | 'each';

export const PANTRY_UNITS: PantryUnit[] = ['g', 'ml', 'each'];

export type PantryItem = {
  id: number;
  name: string;
  brand: string | null;
  photo_url: string | null;
  quantity: number;
  unit: PantryUnit;
  category: string | null;
  barcode: string | null;
  off_id: string | null;
  /** JSON-encoded Nutrition, or null. Use parseNutrition to read it. */
  nutrition: string | null;
  /** What the item held when last stocked; drives the level bar. */
  original_quantity: number | null;
  updated_at: string;
};

/** Below this fraction remaining, an item counts as running low. */
export const LOW_STOCK_FRACTION = 0.25;

/** How full an item is, for the level bar and the LOW badge. */
export function stockLevel(item: PantryItem): { fraction: number; low: boolean } {
  const original = item.original_quantity && item.original_quantity > 0
    ? item.original_quantity
    : item.quantity;
  const fraction = original > 0 ? Math.min(1, item.quantity / original) : 0;
  return { fraction, low: item.quantity <= 0 || fraction < LOW_STOCK_FRACTION };
}

export type PantryItemInput = {
  name: string;
  brand?: string | null;
  quantity: number;
  unit: PantryUnit;
  category?: string | null;
  photo_url?: string | null;
  off_id?: string | null;
  nutrition?: Nutrition | null;
};

export async function listPantryItems(db: SQLiteDatabase, search = ''): Promise<PantryItem[]> {
  const term = search.trim();
  if (term) {
    return db.getAllAsync<PantryItem>(
      `SELECT * FROM pantry_items
       WHERE name LIKE '%' || ? || '%' OR brand LIKE '%' || ? || '%' OR category LIKE '%' || ? || '%'
       ORDER BY name COLLATE NOCASE`,
      term,
      term,
      term
    );
  }
  return db.getAllAsync<PantryItem>('SELECT * FROM pantry_items ORDER BY name COLLATE NOCASE');
}

/**
 * An existing item that means the same food, so a repeat purchase tops up
 * what's already there instead of creating a second card. Brand is ignored
 * on purpose — raspberries are raspberries. Units must agree, since adding
 * 500 g to 2 L is meaningless.
 */
export async function findSimilarItem(
  db: SQLiteDatabase,
  name: string,
  unit: PantryUnit,
  excludeId?: number
): Promise<PantryItem | null> {
  const candidates = await db.getAllAsync<PantryItem>(
    'SELECT * FROM pantry_items WHERE unit = ?',
    unit
  );

  let best: PantryItem | null = null;
  let bestScore = 0;
  for (const item of candidates) {
    if (item.id === excludeId) continue;
    const score = matchScore(name, item.name);
    if (score >= NAME_CONTAINMENT_SCORE && score > bestScore) {
      best = item;
      bestScore = score;
    }
  }
  return best;
}

/** Items that never got a product match — the backfill targets these. */
export async function listItemsMissingPhotos(db: SQLiteDatabase): Promise<PantryItem[]> {
  return db.getAllAsync<PantryItem>(
    "SELECT * FROM pantry_items WHERE photo_url IS NULL OR photo_url = '' ORDER BY name COLLATE NOCASE"
  );
}

export async function getPantryItem(db: SQLiteDatabase, id: number): Promise<PantryItem | null> {
  return db.getFirstAsync<PantryItem>('SELECT * FROM pantry_items WHERE id = ?', id);
}

export async function insertPantryItem(db: SQLiteDatabase, item: PantryItemInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO pantry_items (name, brand, quantity, unit, category, photo_url, off_id, nutrition, original_quantity)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    item.name.trim(),
    item.brand?.trim() || null,
    item.quantity,
    item.unit,
    item.category?.trim() || null,
    item.photo_url || null,
    item.off_id || null,
    item.nutrition ? JSON.stringify(item.nutrition) : null,
    item.quantity
  );
  return result.lastInsertRowId;
}

export async function updatePantryItem(
  db: SQLiteDatabase,
  id: number,
  item: PantryItemInput
): Promise<void> {
  await db.runAsync(
    `UPDATE pantry_items
     SET name = ?, brand = ?, quantity = ?, unit = ?, category = ?,
         photo_url = ?, off_id = ?, nutrition = ?, updated_at = datetime('now'),
         -- Restocking by hand raises the baseline the level bar measures against.
         original_quantity = MAX(COALESCE(original_quantity, 0), ?)
     WHERE id = ?`,
    item.name.trim(),
    item.brand?.trim() || null,
    item.quantity,
    item.unit,
    item.category?.trim() || null,
    item.photo_url || null,
    item.off_id || null,
    item.nutrition ? JSON.stringify(item.nutrition) : null,
    item.quantity,
    id
  );
}

/** Tops up an existing item, leaving its photo, brand and nutrition alone. */
export async function addToPantryItem(
  db: SQLiteDatabase,
  id: number,
  amount: number
): Promise<void> {
  await db.runAsync(
    `UPDATE pantry_items
     SET quantity = quantity + ?,
         original_quantity = COALESCE(original_quantity, 0) + ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    amount,
    amount,
    id
  );
}

export async function deletePantryItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM pantry_items WHERE id = ?', id);
}

export function parseNutrition(raw: string | null): Nutrition | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Nutrition;
    return parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function formatQuantity(quantity: number, unit: PantryUnit): string {
  if (unit === 'each') return quantity === 1 ? '1' : `${quantity}`;
  if (unit === 'g' && quantity >= 1000) return `${trimZeros(quantity / 1000)} kg`;
  if (unit === 'ml' && quantity >= 1000) return `${trimZeros(quantity / 1000)} L`;
  return `${trimZeros(quantity)} ${unit}`;
}

function trimZeros(n: number): string {
  return Number(n.toFixed(2)).toString();
}

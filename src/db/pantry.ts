import type { SQLiteDatabase } from 'expo-sqlite';

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
  updated_at: string;
};

export type PantryItemInput = {
  name: string;
  brand?: string | null;
  quantity: number;
  unit: PantryUnit;
  category?: string | null;
  photo_url?: string | null;
  off_id?: string | null;
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

export async function getPantryItem(db: SQLiteDatabase, id: number): Promise<PantryItem | null> {
  return db.getFirstAsync<PantryItem>('SELECT * FROM pantry_items WHERE id = ?', id);
}

export async function insertPantryItem(db: SQLiteDatabase, item: PantryItemInput): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO pantry_items (name, brand, quantity, unit, category, photo_url, off_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    item.name.trim(),
    item.brand?.trim() || null,
    item.quantity,
    item.unit,
    item.category?.trim() || null,
    item.photo_url || null,
    item.off_id || null
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
         photo_url = ?, off_id = ?, updated_at = datetime('now')
     WHERE id = ?`,
    item.name.trim(),
    item.brand?.trim() || null,
    item.quantity,
    item.unit,
    item.category?.trim() || null,
    item.photo_url || null,
    item.off_id || null,
    id
  );
}

export async function deletePantryItem(db: SQLiteDatabase, id: number): Promise<void> {
  await db.runAsync('DELETE FROM pantry_items WHERE id = ?', id);
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

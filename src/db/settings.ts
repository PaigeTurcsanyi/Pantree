import type { SQLiteDatabase } from 'expo-sqlite';

export async function getSetting(db: SQLiteDatabase, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    key
  );
  return row?.value ?? null;
}

export async function setSetting(db: SQLiteDatabase, key: string, value: string): Promise<void> {
  await db.runAsync(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value
  );
}

export async function deleteSetting(db: SQLiteDatabase, key: string): Promise<void> {
  await db.runAsync('DELETE FROM settings WHERE key = ?', key);
}

export const GEMINI_KEY_SETTING = 'gemini_api_key';

/** Key pasted in Settings wins; falls back to the .env dev key. */
export async function getGeminiApiKey(db: SQLiteDatabase): Promise<string | null> {
  const stored = await getSetting(db, GEMINI_KEY_SETTING);
  return stored || process.env.EXPO_PUBLIC_GEMINI_API_KEY || null;
}

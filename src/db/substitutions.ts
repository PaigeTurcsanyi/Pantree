import type { SQLiteDatabase } from 'expo-sqlite';

import type { Substitution } from '@/db/cooking';

export async function listSubstitutions(db: SQLiteDatabase): Promise<Substitution[]> {
  return db.getAllAsync<Substitution>('SELECT * FROM substitutions ORDER BY ingredient');
}

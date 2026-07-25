import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PantryScreen() {
  const db = useSQLiteContext();
  const insets = useSafeAreaInsets();
  const [itemCount, setItemCount] = useState<number | null>(null);

  useEffect(() => {
    db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM pantry_items')
      .then((row) => setItemCount(row?.count ?? 0))
      .catch(() => setItemCount(null));
  }, [db]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedText type="subtitle">Pantry</ThemedText>
      <ThemedView style={styles.emptyState}>
        <ThemedText type="default" themeColor="textSecondary" style={styles.centered}>
          Your pantry is empty.
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
          {itemCount === null
            ? 'Connecting to database…'
            : `Database ready — ${itemCount} item${itemCount === 1 ? '' : 's'} stored.`}
        </ThemedText>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  centered: {
    textAlign: 'center',
  },
});

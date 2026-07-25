import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatQuantity, listPantryItems, PantryItem } from '@/db/pantry';
import { useTheme } from '@/hooks/use-theme';

export default function PantryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    listPantryItems(db, search).then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
  }, [db, search]);

  useEffect(refresh, [refresh]);
  useFocusEffect(refresh);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedView style={styles.header}>
        <ThemedText type="subtitle">Pantry</ThemedText>
        <Pressable
          onPress={() => router.push('/item/new')}
          style={[styles.addButton, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="smallBold">+ Add item</ThemedText>
        </Pressable>
      </ThemedView>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search pantry"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[
          styles.search,
          { backgroundColor: theme.backgroundElement, color: theme.text },
        ]}
      />

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={items.length === 0 ? styles.emptyList : styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/item/${item.id}`)}>
            {({ pressed }) => (
              <ThemedView
                type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                style={styles.row}>
                <ThemedView
                  type={pressed ? 'backgroundSelected' : 'backgroundElement'}
                  style={styles.rowText}>
                  <ThemedText>{item.name}</ThemedText>
                  {item.brand ? (
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.brand}
                    </ThemedText>
                  ) : null}
                </ThemedView>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {formatQuantity(item.quantity, item.unit)}
                  {item.unit === 'each' ? ` ${item.quantity === 1 ? 'item' : 'items'}` : ''}
                </ThemedText>
              </ThemedView>
            )}
          </Pressable>
        )}
        ListEmptyComponent={
          loaded ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {search
                ? `Nothing matches “${search}”.`
                : 'Your pantry is empty. Tap “+ Add item” to get started.'}
            </ThemedText>
          ) : null
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  search: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  list: {
    gap: 8,
    paddingBottom: 24,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});

import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { formatQuantity, listPantryItems, PantryItem } from '@/db/pantry';
import { useTheme } from '@/hooks/use-theme';

const GAP = 12;
const MIN_CARD_WIDTH = 150;

export default function PantryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Fill the width with as many cards as fit comfortably — 2 on a phone,
  // more on an iPad.
  const columns = Math.max(2, Math.floor((width - 40 + GAP) / (MIN_CARD_WIDTH + GAP)));

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
        <ThemedView style={styles.headerButtons}>
          <Pressable
            onPress={() => router.push('/import')}
            style={[styles.addButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">Import</ThemedText>
          </Pressable>
          <Pressable
            onPress={() => router.push('/item/new')}
            style={[styles.addButton, { backgroundColor: theme.backgroundElement }]}>
            <ThemedText type="smallBold">+ Add</ThemedText>
          </Pressable>
        </ThemedView>
      </ThemedView>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search pantry"
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        style={[styles.search, { backgroundColor: theme.backgroundElement, color: theme.text }]}
      />

      <FlatList
        key={columns}
        data={items}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        columnWrapperStyle={styles.column}
        contentContainerStyle={items.length === 0 ? styles.emptyList : styles.grid}
        renderItem={({ item }) => (
          <PantryCard item={item} onPress={() => router.push(`/item/${item.id}`)} />
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

function PantryCard({ item, onPress }: { item: PantryItem; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.cardPressable}>
      {({ pressed }) => (
        <ThemedView
          type={pressed ? 'backgroundSelected' : 'backgroundElement'}
          style={styles.card}>
          <ThemedView type="backgroundSelected" style={styles.photoWrap}>
            {item.photo_url ? (
              <Image
                source={item.photo_url}
                style={styles.photo}
                contentFit="contain"
                transition={150}
              />
            ) : (
              <ThemedText type="title" themeColor="textSecondary" style={styles.placeholderLetter}>
                {item.name.slice(0, 1).toUpperCase()}
              </ThemedText>
            )}
          </ThemedView>

          <ThemedView
            type={pressed ? 'backgroundSelected' : 'backgroundElement'}
            style={styles.cardText}>
            <ThemedText type="small" numberOfLines={2}>
              {item.name}
            </ThemedText>
            {item.brand ? (
              <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                {item.brand}
              </ThemedText>
            ) : null}
            <ThemedText type="smallBold" style={styles.quantity}>
              {formatQuantity(item.quantity, item.unit)}
              {item.unit === 'each' ? ` ${item.quantity === 1 ? 'item' : 'items'}` : ''}
            </ThemedText>
          </ThemedView>
        </ThemedView>
      )}
    </Pressable>
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
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
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
  grid: {
    gap: GAP,
    paddingBottom: 24,
  },
  column: {
    gap: GAP,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  emptyText: {
    textAlign: 'center',
  },
  cardPressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    gap: 10,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  placeholderLetter: {
    fontSize: 40,
    lineHeight: 48,
  },
  cardText: {
    gap: 2,
  },
  quantity: {
    marginTop: 2,
  },
});

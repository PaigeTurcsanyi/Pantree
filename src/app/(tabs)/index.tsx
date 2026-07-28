import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconButton, LevelBar, Pill, ProductTile, SearchField, TileBadge } from '@/components/ui';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import {
  formatQuantity,
  listPantryItems,
  PantryItem,
  stockLevel,
  updatePantryItem,
} from '@/db/pantry';
import { useTheme } from '@/hooks/use-theme';

const GAP = Spacing.grid;
const MIN_CARD_WIDTH = 150;

export default function PantryScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [items, setItems] = useState<PantryItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const columns = Math.max(
    2,
    Math.floor((width - Spacing.screen * 2 + GAP) / (MIN_CARD_WIDTH + GAP))
  );

  const refresh = useCallback(() => {
    listPantryItems(db, search).then((rows) => {
      setItems(rows);
      setLoaded(true);
    });
  }, [db, search]);

  useEffect(refresh, [refresh]);
  useFocusEffect(refresh);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const item of items) if (item.category?.trim()) names.add(item.category.trim());
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const visible = category
    ? items.filter((item) => item.category?.trim() === category)
    : items;

  const lowCount = items.filter((item) => stockLevel(item).low).length;

  /** Lets you attach your own picture when Open Food Facts has none. */
  const attachPhoto = async (item: PantryItem) => {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (picked.canceled) return;
    await updatePantryItem(db, item.id, {
      name: item.name,
      brand: item.brand,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      photo_url: picked.assets[0].uri,
      off_id: item.off_id,
    });
    refresh();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.wordmark}>
          <View style={styles.wordmarkRow}>
            <Icon name="eco" size={26} color={theme.accent} />
            <ThemedText type="subtitle">Pantree</ThemedText>
          </View>
          <ThemedText type="meta" themeColor="textSecondary">
            {items.length} {items.length === 1 ? 'thing' : 'things'} growing in your pantry
            {lowCount > 0 ? ' · ' : ''}
            {lowCount > 0 ? (
              <ThemedText type="meta" style={{ color: theme.warn, fontWeight: '700' }}>
                {lowCount} running low
              </ThemedText>
            ) : null}
          </ThemedText>
        </View>
        <View style={styles.headerButtons}>
          <IconButton
            icon="photo_camera"
            onPress={() => router.push('/import')}
            accessibilityLabel="Import from screenshot"
          />
          <IconButton
            icon="add"
            variant="accent"
            onPress={() => router.push('/item/new')}
            accessibilityLabel="Add an item"
          />
        </View>
      </View>

      <SearchField value={search} onChangeText={setSearch} placeholder="Search your pantry" />

      {categories.length > 0 && (
        <View style={styles.chipRow}>
          <Pill label="All" active={category === null} onPress={() => setCategory(null)} />
          {categories.map((name) => (
            <Pill
              key={name}
              label={name}
              active={category === name}
              onPress={() => setCategory(name)}
            />
          ))}
        </View>
      )}

      <FlatList
        key={columns}
        data={visible}
        keyExtractor={(item) => String(item.id)}
        numColumns={columns}
        columnWrapperStyle={styles.column}
        contentContainerStyle={visible.length === 0 ? styles.emptyList : styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <PantryCard
            item={item}
            onPress={() => router.push(`/item/${item.id}`)}
            onAttachPhoto={() => attachPhoto(item)}
          />
        )}
        ListEmptyComponent={
          loaded ? (
            <ThemedText themeColor="textSecondary" style={styles.emptyText}>
              {search || category
                ? 'Nothing here matches that.'
                : 'Your pantry is empty. Import a grocery screenshot or add something by hand.'}
            </ThemedText>
          ) : null
        }
      />
    </ThemedView>
  );
}

function PantryCard({
  item,
  onPress,
  onAttachPhoto,
}: {
  item: PantryItem;
  onPress: () => void;
  onAttachPhoto: () => void;
}) {
  const theme = useTheme();
  const { fraction, low } = stockLevel(item);

  return (
    <Pressable onPress={onPress} style={styles.cardPressable}>
      {({ pressed }) => (
        <View
          style={[
            styles.card,
            { backgroundColor: theme.surface, borderColor: theme.hairline },
            pressed && styles.cardPressed,
          ]}>
          <ProductTile
            photoUrl={item.photo_url}
            name={item.name}
            category={item.category}
            style={styles.tile}>
            {low ? <TileBadge label="LOW" tone="warn" /> : null}
            <Pressable
              onPress={onAttachPhoto}
              style={styles.tileAction}
              accessibilityLabel={`Add a photo for ${item.name}`}>
              <Icon name="add_a_photo" size={14} color={theme.textSecondary} />
            </Pressable>
          </ProductTile>

          <View style={styles.cardBody}>
            <ThemedText type="cardName" numberOfLines={2}>
              {item.name}
            </ThemedText>
            {item.brand ? (
              <ThemedText type="meta" themeColor="textMuted" numberOfLines={1}>
                {item.brand}
              </ThemedText>
            ) : null}
          </View>

          <View style={styles.cardFooter}>
            <ThemedText
              type="meta"
              style={[styles.quantity, low && { color: theme.warn }]}>
              {formatQuantity(item.quantity, item.unit)}
              {item.unit === 'each' ? ` ${item.quantity === 1 ? 'item' : 'items'}` : ''}
            </ThemedText>
            <LevelBar fraction={fraction} low={low} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing.screen,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  wordmark: {
    flex: 1,
    gap: 2,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  grid: {
    gap: GAP,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.five,
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
    paddingHorizontal: Spacing.four,
  },
  cardPressable: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderRadius: Radius.card,
    borderWidth: 1,
    padding: 9,
    gap: Spacing.two,
    ...Shadows.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  tile: {
    width: '100%',
    aspectRatio: 1,
  },
  tileAction: {
    position: 'absolute',
    right: 6,
    bottom: 6,
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,248,0.85)',
  },
  cardBody: {
    gap: 1,
  },
  cardFooter: {
    marginTop: 'auto',
    gap: 6,
  },
  quantity: {
    fontWeight: '700',
    fontSize: 13,
  },
});

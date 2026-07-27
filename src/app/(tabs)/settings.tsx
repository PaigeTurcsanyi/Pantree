import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { searchProducts } from '@/api/openfoodfacts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { listItemsMissingPhotos, updatePantryItem } from '@/db/pantry';
import { deleteSetting, GEMINI_KEY_SETTING, getSetting, setSetting } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');
  const [backfilling, setBackfilling] = useState(false);
  const [backfillStatus, setBackfillStatus] = useState('');

  const envKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  useEffect(() => {
    getSetting(db, GEMINI_KEY_SETTING).then(setSavedKey);
  }, [db]);

  const saveKey = async () => {
    const key = draft.trim();
    if (!key) return;
    await setSetting(db, GEMINI_KEY_SETTING, key);
    setSavedKey(key);
    setDraft('');
    setStatus('Key saved.');
  };

  const clearKey = async () => {
    await deleteSetting(db, GEMINI_KEY_SETTING);
    setSavedKey(null);
    setStatus(envKey ? 'Key removed — using the built-in dev key.' : 'Key removed.');
  };

  /**
   * Re-runs the product lookup for every item without a photo. Each item is
   * tried on its full name+brand, then the bare name, so a store label that
   * Open Food Facts has never heard of still lands a representative photo.
   */
  const backfillPhotos = async () => {
    setBackfilling(true);
    setBackfillStatus('');
    try {
      const items = await listItemsMissingPhotos(db);
      if (items.length === 0) {
        setBackfillStatus('Every item already has a photo.');
        return;
      }

      let found = 0;
      for (const [index, item] of items.entries()) {
        setBackfillStatus(`Looking up ${index + 1} of ${items.length}…`);
        try {
          const results = await searchProducts(item.name, item.brand);
          const match = results.find((r) => r.imageUrl);
          if (!match) continue;
          await updatePantryItem(db, item.id, {
            name: item.name,
            brand: item.brand,
            quantity: item.quantity,
            unit: item.unit,
            category: item.category,
            photo_url: match.imageUrl,
            off_id: match.code,
            nutrition: match.nutrition,
          });
          found += 1;
        } catch {
          // One bad lookup shouldn't stop the rest.
        }
      }

      const missed = items.length - found;
      setBackfillStatus(
        found === 0
          ? `No photos found for those ${items.length} items.`
          : `Added ${found} photo${found === 1 ? '' : 's'}.` +
              (missed > 0 ? ` ${missed} still had no match.` : '')
      );
    } finally {
      setBackfilling(false);
    }
  };

  const mask = (key: string) => `${key.slice(0, 6)}…${key.slice(-4)}`;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedText type="subtitle">Settings</ThemedText>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="smallBold" themeColor="textSecondary">
          Gemini API key
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Used to read grocery screenshots. Get a free key at aistudio.google.com/apikey. The
          key stays on this device.
        </ThemedText>

        <ThemedText type="small" themeColor="textSecondary">
          {savedKey
            ? `Current key: ${mask(savedKey)}`
            : envKey
              ? `Using the built-in dev key (${mask(envKey)}).`
              : 'No key set yet.'}
        </ThemedText>

        <TextInput
          value={draft}
          onChangeText={setDraft}
          placeholder="Paste a Gemini API key"
          placeholderTextColor={theme.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          style={[styles.input, { backgroundColor: theme.backgroundElement, color: theme.text }]}
        />

        <Pressable onPress={saveKey} disabled={!draft.trim()}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            <ThemedText type="smallBold">Save key</ThemedText>
          </ThemedView>
        </Pressable>

        {savedKey && (
          <Pressable onPress={clearKey}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText type="smallBold" style={styles.removeText}>
                Remove saved key
              </ThemedText>
            </ThemedView>
          </Pressable>
        )}

        {status ? (
          <ThemedText type="small" themeColor="textSecondary">
            {status}
          </ThemedText>
        ) : null}

        <ThemedView style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            Product photos
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Looks up every pantry item that has no photo yet and pulls one in from Open Food
            Facts, along with its nutrition facts.
          </ThemedText>
          <Pressable onPress={backfillPhotos} disabled={backfilling}>
            <ThemedView type="backgroundElement" style={styles.button}>
              <ThemedText type="smallBold">
                {backfilling ? 'Searching…' : 'Find missing photos'}
              </ThemedText>
            </ThemedView>
          </Pressable>
          {backfillStatus ? (
            <ThemedText type="small" themeColor="textSecondary">
              {backfillStatus}
            </ThemedText>
          ) : null}
        </ThemedView>

        <ThemedView style={styles.aboutBlock}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            About
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Pantree — a local-first pantry. All data lives on this device. Product photos and
            package sizes come from Open Food Facts.
          </ThemedText>
        </ThemedView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    gap: 10,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  input: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  button: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  removeText: {
    color: '#e5484d',
  },
  section: {
    marginTop: 24,
    gap: 8,
  },
  aboutBlock: {
    marginTop: 24,
    gap: 6,
  },
});

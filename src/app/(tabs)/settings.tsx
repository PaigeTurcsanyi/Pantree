import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { deleteSetting, GEMINI_KEY_SETTING, getSetting, setSetting } from '@/db/settings';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState('');

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
  aboutBlock: {
    marginTop: 24,
    gap: 6,
  },
});

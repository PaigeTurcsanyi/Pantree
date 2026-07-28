import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Link, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { parseGroceryScreenshot } from '@/api/gemini';
import { toReviewItem } from '@/api/vision';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getGeminiApiKey } from '@/db/settings';
import { setImportDraft } from '@/state/import-draft';

type PickedImage = {
  uri: string;
  base64: string;
  mimeType: string;
};

export default function ImportScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [missingKey, setMissingKey] = useState(false);

  const pickImage = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset.base64) {
      setError('Couldn’t read that image. Try another one.');
      return;
    }
    setImage({
      uri: asset.uri,
      base64: asset.base64,
      mimeType: asset.mimeType ?? 'image/jpeg',
    });
  };

  const parse = async () => {
    if (!image) return;
    setError('');
    setMissingKey(false);
    setParsing(true);
    try {
      const apiKey = await getGeminiApiKey(db);
      if (!apiKey) {
        setMissingKey(true);
        return;
      }
      const items = await parseGroceryScreenshot(image.base64, image.mimeType, apiKey);
      if (items.length === 0) {
        setError('No grocery items found in that screenshot. Try a clearer one.');
        return;
      }
      setImportDraft(items.map(toReviewItem));
      setImage(null);
      router.push('/review');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setParsing(false);
    }
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ThemedText type="subtitle">Import</ThemedText>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText themeColor="textSecondary">
          Pick a screenshot of an online grocery order. The AI reads it into a list you can
          review and edit before anything is saved.
        </ThemedText>

        <Pressable onPress={pickImage} disabled={parsing}>
          <ThemedView type="backgroundElement" style={styles.pickButton}>
            <ThemedText type="smallBold">
              {image ? 'Choose a different screenshot' : 'Choose screenshot'}
            </ThemedText>
          </ThemedView>
        </Pressable>

        {image && (
          <>
            <Image source={image.uri} style={styles.preview} contentFit="contain" />
            <Pressable onPress={parse} disabled={parsing}>
              <ThemedView type="backgroundSelected" style={styles.parseButton}>
                {parsing ? (
                  <ActivityIndicator />
                ) : (
                  <ThemedText type="smallBold">Read items from screenshot</ThemedText>
                )}
              </ThemedView>
            </Pressable>
          </>
        )}

        {missingKey && (
          <ThemedText themeColor="textSecondary">
            No Gemini API key set.{' '}
            <Link href="/settings">
              <ThemedText type="linkPrimary">Add one in Settings</ThemedText>
            </Link>{' '}
            — it’s free at aistudio.google.com/apikey.
          </ThemedText>
        )}

        {error ? (
          <ThemedText type="smallBold" style={styles.error}>
            {error}
          </ThemedText>
        ) : null}
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
    gap: 14,
    paddingVertical: 16,
    paddingBottom: 32,
  },
  pickButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  parseButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    minHeight: 48,
    justifyContent: 'center',
  },
  preview: {
    width: '100%',
    height: 320,
    borderRadius: 12,
  },
  error: {
    color: '#e5484d',
  },
});

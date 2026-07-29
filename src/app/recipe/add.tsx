import { Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const OPTIONS = [
  {
    icon: 'menu_book',
    title: 'Write it down',
    body: 'Type the title, ingredients and method yourself.',
    href: '/recipe/edit/new' as const,
  },
  {
    icon: 'photo_camera',
    title: 'From a screenshot',
    body: 'Read a recipe photo or cookbook page and fill the form in for you.',
    href: '/recipe/edit/new?import=1' as const,
  },
  {
    icon: 'eco',
    title: 'Browse starter recipes',
    body: 'Simple recipes built into the app. Add any of them to your book.',
    href: '/recipe/browse' as const,
  },
];

export default function AddRecipeScreen() {
  const router = useRouter();
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: 'Add a recipe' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {OPTIONS.map((option) => (
          <Pressable key={option.title} onPress={() => router.replace(option.href)}>
            {({ pressed }) => (
              <View
                style={[
                  styles.card,
                  { backgroundColor: theme.surface, borderColor: theme.hairline },
                  pressed && styles.pressed,
                ]}>
                <View style={[styles.iconWrap, { backgroundColor: theme.successSoft }]}>
                  <Icon name={option.icon} size={22} color={theme.accent} />
                </View>
                <View style={styles.cardText}>
                  <ThemedText type="cardTitle">{option.title}</ThemedText>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {option.body}
                  </ThemedText>
                </View>
                <Icon name="chevron_right" size={20} color={theme.chevron} />
              </View>
            )}
          </Pressable>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.screen,
    gap: Spacing.row,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderRadius: Radius.card,
    padding: 14,
    ...Shadows.card,
  },
  pressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: Radius.thumbnail,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
});

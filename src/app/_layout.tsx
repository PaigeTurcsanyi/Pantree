import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { Suspense } from 'react';
import { useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts } from '@/constants/theme';
import { DATABASE_NAME, migrateDbIfNeeded } from '@/db';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const colors = Colors[scheme];

  // Navigation chrome has to be told about the palette separately, otherwise
  // modal headers stay stock white against the cream screens.
  const navigationTheme = {
    ...(scheme === 'dark' ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === 'dark' ? DarkTheme : DefaultTheme).colors,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.searchBorder,
      primary: colors.accent,
    },
  };

  return (
    <ThemeProvider value={navigationTheme}>
      <Suspense fallback={<ThemedView style={{ flex: 1 }} />}>
        <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDbIfNeeded} useSuspense>
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background },
              headerTintColor: colors.accent,
              headerTitleStyle: {
                color: colors.text,
                fontFamily: Fonts.serif,
                fontSize: 18,
                fontWeight: '600',
              },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="item/[id]" options={{ presentation: 'modal', title: 'Item' }} />
            <Stack.Screen
              name="import"
              options={{ presentation: 'modal', title: 'Import from screenshot' }}
            />
            <Stack.Screen name="review" options={{ presentation: 'modal', title: 'Review items' }} />
            <Stack.Screen name="recipe/[id]" options={{ title: 'Recipe' }} />
            <Stack.Screen
              name="recipe/add"
              options={{ presentation: 'modal', title: 'Add a recipe' }}
            />
            <Stack.Screen
              name="recipe/browse"
              options={{ presentation: 'modal', title: 'Starter recipes' }}
            />
            <Stack.Screen
              name="recipe/edit/[id]"
              options={{ presentation: 'modal', title: 'Recipe' }}
            />
          </Stack>
        </SQLiteProvider>
      </Suspense>
    </ThemeProvider>
  );
}

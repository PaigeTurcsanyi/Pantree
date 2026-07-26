// Web fallback: NativeTabs is iOS/Android-only, so the browser preview uses
// the classic JS tab bar instead.
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/hooks/use-theme';

export default function AppTabs() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pantry',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'basket', web: 'shopping_basket' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: 'Import',
          tabBarIcon: ({ color, size }) => (
            <SymbolView
              name={{ ios: 'camera.viewfinder', web: 'document_scanner' }}
              tintColor={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="recipes"
        options={{
          title: 'Recipes',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'book', web: 'menu_book' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="make"
        options={{
          title: 'Can I Make?',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'fork.knife', web: 'restaurant' }} tintColor={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <SymbolView name={{ ios: 'gearshape', web: 'settings' }} tintColor={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

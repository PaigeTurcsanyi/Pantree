import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ImageSourcePropType,
  type ViewStyle,
} from 'react-native';

import { foodIconFor, Icon } from '@/components/icon';
import { ThemedText } from '@/components/themed-text';
import { Radius, Shadows, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** 42×42 rounded action button used in screen headers. */
export function IconButton({
  icon,
  onPress,
  variant = 'sunken',
  size = 42,
  accessibilityLabel,
}: {
  icon: string;
  onPress: () => void;
  variant?: 'sunken' | 'accent' | 'translucent';
  size?: number;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  const background =
    variant === 'accent'
      ? theme.accent
      : variant === 'translucent'
        ? 'rgba(246,241,231,0.9)'
        : theme.surfaceSunken;
  const tint = variant === 'accent' ? theme.accentText : theme.accent;

  return (
    <Pressable onPress={onPress} accessibilityLabel={accessibilityLabel} accessibilityRole="button">
      {({ pressed }) => (
        <View
          style={[
            styles.iconButton,
            { width: size, height: size, backgroundColor: background },
            pressed && styles.pressed,
          ]}>
          <Icon name={icon} size={size * 0.45} color={tint} />
        </View>
      )}
    </Pressable>
  );
}

export function SearchField({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: theme.surface, borderColor: theme.searchBorder },
      ]}>
      <Icon name="search" size={19} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        autoCorrect={false}
        style={[styles.searchInput, { color: theme.text }]}
      />
    </View>
  );
}

/** Rounded filter/tag chip. */
export function Pill({
  label,
  active,
  onPress,
  tone = 'default',
  icon,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'success';
  icon?: string;
}) {
  const theme = useTheme();

  const background = active
    ? theme.accent
    : tone === 'success'
      ? theme.successSoft
      : theme.surfaceSunken;
  const color = active ? theme.accentText : tone === 'success' ? theme.success : theme.text;

  const body = (
    <View style={[styles.pill, { backgroundColor: background }]}>
      {icon ? <Icon name={icon} size={14} color={color} /> : null}
      <ThemedText type="chip" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );

  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {({ pressed }) => <View style={pressed ? styles.pressed : undefined}>{body}</View>}
    </Pressable>
  );
}

/**
 * Tinted tile that sits behind a product photo. The tint keeps both a
 * white-background Open Food Facts photo and a transparent PNG looking clean,
 * and shows a food glyph when there's no photo at all.
 */
export function ProductTile({
  photoUrl,
  imageSource,
  name,
  category,
  style,
  iconSize = 42,
  radius = Radius.tile,
  contentFit = 'contain',
  children,
}: {
  photoUrl?: string | null;
  /** Bundled image, used when there's no photo_url of your own. */
  imageSource?: ImageSourcePropType;
  name: string;
  category?: string | null;
  style?: ViewStyle;
  iconSize?: number;
  radius?: number;
  contentFit?: 'contain' | 'cover';
  children?: React.ReactNode;
}) {
  const theme = useTheme();
  const source = photoUrl ?? imageSource;

  return (
    <LinearGradient
      colors={[theme.tileTop, theme.tileBottom]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.tile, { borderRadius: radius }, style]}>
      {source ? (
        <Image
          source={source}
          style={styles.tileImage}
          contentFit={photoUrl ? contentFit : 'cover'}
          transition={150}
        />
      ) : (
        <Icon name={foodIconFor(name, category)} size={iconSize} color={theme.accent} />
      )}
      {children}
    </LinearGradient>
  );
}

/** Small status pill overlaid on a tile, e.g. LOW. */
export function TileBadge({ label, tone }: { label: string; tone: 'warn' | 'fresh' }) {
  const theme = useTheme();
  const background = tone === 'warn' ? theme.warn : 'rgba(255,253,248,0.92)';
  const color = tone === 'warn' ? '#FFFFFF' : theme.accent;

  return (
    <View style={[styles.tileBadge, { backgroundColor: background }]}>
      {tone === 'fresh' ? <Icon name="eco" size={11} color={color} /> : null}
      <ThemedText type="badge" style={{ color }}>
        {label}
      </ThemedText>
    </View>
  );
}

/** Thin progress bar showing how much of an item is left. */
export function LevelBar({ fraction, low }: { fraction: number; low: boolean }) {
  const theme = useTheme();
  const width = `${Math.max(4, Math.min(100, Math.round(fraction * 100)))}%` as const;

  return (
    <View style={[styles.levelTrack, { backgroundColor: theme.hairline }]}>
      <View
        style={[styles.levelFill, { width, backgroundColor: low ? theme.warn : theme.success }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    borderRadius: Radius.iconButton,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.search,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    // Removes the default web focus ring so the border reads as the field.
    outlineStyle: 'none' as never,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: Radius.pill,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  tile: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  tileBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: Radius.pill,
    paddingVertical: 3,
    paddingHorizontal: 7,
  },
  levelTrack: {
    height: 5,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  levelFill: {
    height: '100%',
    borderRadius: Radius.pill,
  },
  card: {
    borderRadius: Radius.card,
    ...Shadows.card,
  },
});

export const cardStyle = styles.card;

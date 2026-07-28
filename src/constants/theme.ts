/**
 * Design tokens for the "warm cream · deep green" direction.
 *
 * The palette is specified for light mode; dark mode reuses the same hues
 * pulled down to a deep green-black so the app still follows the system
 * setting without looking like a different product.
 *
 * `backgroundElement` and `backgroundSelected` are kept as aliases of
 * `surface` / `surfaceSunken` because ThemedView call sites across the app
 * reference them by name.
 */

import { Platform } from 'react-native';

export const Colors = {
  light: {
    /** Warm cream screen canvas. */
    background: '#F6F1E7',
    /** Cards and list rows. */
    surface: '#FFFDF8',
    /** Inactive chips and image tiles. */
    surfaceSunken: '#EFE8D8',
    backgroundElement: '#FFFDF8',
    backgroundSelected: '#EFE8D8',

    accent: '#1F4636',
    accentText: '#F6F1E7',

    text: '#26332B',
    textSecondary: '#6A7363',
    textMuted: '#8A917E',

    success: '#2F7D54',
    successSoft: '#E4EFE4',
    warn: '#C47B34',
    warnSoft: '#FBF1E2',
    warnSoftBorder: '#EDD9BF',
    warnText: '#A2632A',
    warnTextSoft: '#9A7C53',
    danger: '#E5484D',

    hairline: 'rgba(38,51,43,0.06)',
    searchBorder: '#E7DFCD',
    tabInactive: '#A7A292',
    chevron: '#C8C2B2',

    /** Fallback tile behind product photos. */
    tileTop: '#EEF2E6',
    tileBottom: '#E4EAD8',
    heroTop: '#26332B',
    heroBottom: '#1A231D',
  },
  dark: {
    background: '#141815',
    surface: '#1C221E',
    surfaceSunken: '#252C27',
    backgroundElement: '#1C221E',
    backgroundSelected: '#252C27',

    accent: '#7FB79A',
    accentText: '#141815',

    text: '#F1EFE7',
    textSecondary: '#A8B0A4',
    textMuted: '#87907F',

    success: '#63B788',
    successSoft: '#23342A',
    warn: '#D9A05F',
    warnSoft: '#2E2820',
    warnSoftBorder: '#463A28',
    warnText: '#E0AE72',
    warnTextSoft: '#B69A72',
    danger: '#F2686D',

    hairline: 'rgba(241,239,231,0.08)',
    searchBorder: '#333A34',
    tabInactive: '#7B837A',
    chevron: '#5A6159',

    tileTop: '#28312A',
    tileBottom: '#212A24',
    heroTop: '#26332B',
    heroBottom: '#141A16',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** New York — the closest system stand-in for Newsreader. */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'system-ui, -apple-system, "Hanken Grotesk", sans-serif',
    serif: 'Newsreader, ui-serif, Georgia, serif',
    rounded: 'system-ui, sans-serif',
    mono: 'ui-monospace, monospace',
  },
});

/** Corner radii from the design spec. */
export const Radius = {
  card: 18,
  tile: 12,
  thumbnail: 14,
  search: 15,
  button: 16,
  iconButton: 14,
  sheet: 26,
  stepChip: 8,
  pill: 999,
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
  /** Screen horizontal padding. */
  screen: 20,
  /** Grid and row gaps. */
  grid: 12,
  row: 10,
} as const;

/** Card and primary-button elevation, mapped from the spec's CSS shadows. */
export const Shadows = {
  card: {
    shadowColor: '#26332B',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  button: {
    shadowColor: '#1F4636',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

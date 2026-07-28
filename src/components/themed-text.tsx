import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextType =
  | 'default'
  | 'title'
  | 'small'
  | 'smallBold'
  /** Screen title / wordmark — display serif. */
  | 'subtitle'
  /** Recipe-detail title — display serif, one step down. */
  | 'displaySmall'
  /** Uppercase section label above a group. */
  | 'sectionLabel'
  /** Card and list-row titles. */
  | 'cardTitle'
  /** Product card name — tighter than cardTitle. */
  | 'cardName'
  /** Metadata, brand lines, status text. */
  | 'meta'
  | 'chip'
  | 'badge'
  | 'link'
  | 'linkPrimary'
  | 'code';

export type ThemedTextProps = TextProps & {
  type?: ThemedTextType;
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'displaySmall' && styles.displaySmall,
        type === 'sectionLabel' && styles.sectionLabel,
        type === 'cardTitle' && styles.cardTitle,
        type === 'cardName' && styles.cardName,
        type === 'meta' && styles.meta,
        type === 'chip' && styles.chip,
        type === 'badge' && styles.badge,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  smallBold: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  default: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 48,
    fontWeight: '600',
    lineHeight: 52,
  },
  subtitle: {
    fontFamily: Fonts.serif,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '600',
    letterSpacing: -0.4,
  },
  displaySmall: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
  },
  cardName: {
    fontSize: 13.5,
    lineHeight: 17,
    fontWeight: '600',
  },
  meta: {
    fontSize: 12.5,
    lineHeight: 17,
    fontWeight: '500',
  },
  chip: {
    fontSize: 13,
    lineHeight: 17,
    fontWeight: '600',
  },
  badge: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  link: {
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
  },
});

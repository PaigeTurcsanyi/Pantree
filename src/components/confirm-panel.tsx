import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

/**
 * In-app confirmation. Deliberately not window.confirm or Alert.alert:
 * browsers suppress native dialogs in some contexts, which silently turned
 * every destructive action into a no-op.
 */
export function ConfirmPanel({
  message,
  confirmLabel,
  destructive,
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ThemedView type="backgroundElement" style={styles.panel}>
      <ThemedText type="small">{message}</ThemedText>
      <ThemedView type="backgroundElement" style={styles.row}>
        <Pressable onPress={onCancel} style={styles.buttonWrap}>
          <ThemedView type="background" style={styles.button}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </ThemedView>
        </Pressable>
        <Pressable onPress={onConfirm} style={styles.buttonWrap}>
          <ThemedView type="backgroundSelected" style={styles.button}>
            <ThemedText type="smallBold" style={destructive ? styles.destructive : undefined}>
              {confirmLabel}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderRadius: 12,
    padding: 14,
    gap: 12,
    marginTop: 10,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  buttonWrap: {
    flex: 1,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  destructive: {
    color: '#e5484d',
  },
});

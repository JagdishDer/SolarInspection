import React, { type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';

interface SafeScreenProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Set false for full-bleed content (e.g., camera) that manages insets itself. */
  includeTop?: boolean;
  /** Adds the bottom inset for screens without a tab bar. */
  includeBottom?: boolean;
}

/**
 * Applies safe-area insets so content never hides behind the Android
 * status bar or gesture navigation bar (edge-to-edge is always on).
 * The background still extends edge-to-edge behind the system bars.
 */
export function SafeScreen({
  children,
  style,
  includeTop = true,
  includeBottom = false,
}: SafeScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.container,
        includeTop && { paddingTop: insets.top },
        includeBottom && { paddingBottom: insets.bottom },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});

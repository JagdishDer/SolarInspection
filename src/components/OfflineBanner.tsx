import React, { useEffect } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

import { useAnimatedValue } from '@/utils/useAnimatedValue';

import { colors, radii, spacing } from '@/constants/theme';
import { useSyncStore } from '@/stores/syncStore';

/**
 * Persistent offline indicator. Slides in when connectivity is lost;
 * reassures the user that work continues offline and will sync later.
 */
export function OfflineBanner() {
  const networkStatus = useSyncStore((s) => s.networkStatus);
  const appear = useAnimatedValue(0);

  useEffect(() => {
    const animation = Animated.timing(appear, {
      toValue: 1,
      duration: 240,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [appear]);

  if (networkStatus === 'online') return null;

  const label =
    networkStatus === 'offline'
      ? 'You are offline. Changes are saved on this device and will sync automatically.'
      : 'Checking connection. Changes are saved on this device.';

  return (
    <Animated.View
      style={[
        styles.banner,
        {
          opacity: appear,
          transform: [
            { translateY: appear.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
          ],
        },
      ]}
      accessibilityRole="alert"
    >
      <Text style={styles.text}>{label}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.warningSoft,
    borderLeftWidth: 4,
    borderLeftColor: colors.sunDeep,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  text: {
    color: colors.sunDeep,
    fontSize: 13,
    fontWeight: '600',
  },
});

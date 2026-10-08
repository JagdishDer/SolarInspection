import React, { useEffect } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { useAnimatedValue } from '@/utils/useAnimatedValue';

import { colors, radii } from '@/constants/theme';

interface ProgressBarProps {
  /** Completed units. */
  value: number;
  /** Total units; <= 0 renders an empty bar. */
  total: number;
}

/** Solar-themed progress bar with an animated amber fill. */
export const ProgressBar = React.memo(function ProgressBar({ value, total }: ProgressBarProps) {
  const ratio = total > 0 ? Math.min(Math.max(value / total, 0), 1) : 0;
  const fill = useAnimatedValue(0);

  useEffect(() => {
    const animation = Animated.timing(fill, {
      toValue: ratio,
      duration: 420,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [ratio, fill]);

  const width = fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.fill, { width }]} />
    </View>
  );
});

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radii.pill,
    backgroundColor: colors.sun,
  },
});

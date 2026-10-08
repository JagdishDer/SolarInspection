import { useMemo } from 'react';
import { Animated } from 'react-native';

/**
 * Creates a stable Animated.Value for the component's lifetime.
 * Callers pass a literal initial value, so the memo never re-computes.
 */
export function useAnimatedValue(initial: number): Animated.Value {
  return useMemo(() => new Animated.Value(initial), [initial]);
}

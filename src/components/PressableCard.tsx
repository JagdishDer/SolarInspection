import React, { useEffect, type ReactNode } from 'react';
import { Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useAnimatedValue } from '@/utils/useAnimatedValue';

interface PressableCardProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Plays a subtle fade/slide entrance on mount (first page of lists only). */
  animateIn?: boolean;
  /** Stagger delay for the entrance animation, in ms. */
  entranceDelay?: number;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'checkbox' | 'radio';
  accessibilityState?: { selected?: boolean; checked?: boolean; disabled?: boolean };
}

/**
 * Interactive card container: springs down on press, springs back with a
 * little bounce on release, and optionally animates its entrance.
 * Used by every list row so touch feedback is consistent app-wide.
 */
export function PressableCard({
  onPress,
  children,
  style,
  animateIn = false,
  entranceDelay = 0,
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: PressableCardProps) {
  const scale = useAnimatedValue(1);
  const entrance = useAnimatedValue(animateIn ? 0 : 1);

  useEffect(() => {
    if (!animateIn) return;
    const animation = Animated.timing(entrance, {
      toValue: 1,
      duration: 280,
      delay: entranceDelay,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [animateIn, entranceDelay, entrance]);

  const pressIn = (): void => {
    Animated.spring(scale, {
      toValue: 0.97,
      speed: 44,
      bounciness: 0,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = (): void => {
    Animated.spring(scale, {
      toValue: 1,
      speed: 30,
      bounciness: 7,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={onPress === undefined}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
    >
      <Animated.View
        style={[
          style,
          {
            opacity: entrance,
            transform: [
              { scale },
              {
                translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              },
            ],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

import React from 'react';
import { Animated, Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';

import { useAnimatedValue } from '@/utils/useAnimatedValue';

import { colors, radii, spacing, touchTarget } from '@/constants/theme';

type Variant = 'primary' | 'secondary' | 'danger' | 'sun';

interface AppButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}

/** Large touch-target button with a springy press animation. */
export function AppButton({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  accessibilityLabel,
}: AppButtonProps) {
  const scale = useAnimatedValue(1);

  const pressIn = (): void => {
    Animated.spring(scale, { toValue: 0.97, speed: 44, bounciness: 0, useNativeDriver: true }).start();
  };
  const pressOut = (): void => {
    Animated.spring(scale, { toValue: 1, speed: 28, bounciness: 6, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
    >
      <Animated.View
        style={[
          styles.base,
          styles[variant],
          (disabled || loading) && styles.disabled,
          { transform: [{ scale }] },
          style,
        ]}
      >
        <Text style={[styles.label, (variant === 'secondary' || variant === 'sun') && styles.labelDark]}>
          {loading ? 'Please wait…' : label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: touchTarget,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  sun: {
    backgroundColor: colors.sunSoft,
    borderWidth: 1,
    borderColor: colors.sun,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  labelDark: {
    color: colors.text,
  },
});

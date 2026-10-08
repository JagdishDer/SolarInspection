import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/constants/theme';

interface EmptyStateProps {
  title: string;
  message?: string;
  icon?: keyof typeof Ionicons.glyphMap;
}

const RAY_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315];

/** Empty state with a small solar illustration above the message. */
export function EmptyState({ title, message, icon = 'checkmark-circle-outline' }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.artWrap}>
        <View style={styles.rayRing}>
          {RAY_ANGLES.map((angle) => (
            <View key={angle} style={styles.rayAnchor}>
              <View
                style={[styles.rayDot, { transform: [{ rotate: `${angle}deg` }, { translateX: 30 }] }]}
              />
            </View>
          ))}
        </View>
        <View style={styles.sun}>
          <Ionicons name={icon} size={24} color={colors.sunDeep} />
        </View>
      </View>
      <Text style={styles.title}>{title}</Text>
      {message !== undefined && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
  },
  artWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  rayRing: {
    position: 'absolute',
    width: 4,
    height: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rayAnchor: {
    position: 'absolute',
    width: 4,
    height: 4,
  },
  rayDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.sun,
    opacity: 0.7,
  },
  sun: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.sunSoft,
    borderWidth: 1,
    borderColor: colors.sun,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
    maxWidth: 280,
  },
});

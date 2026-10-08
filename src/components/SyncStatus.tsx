import React, { useEffect } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAnimatedValue } from '@/utils/useAnimatedValue';
import { Ionicons } from '@expo/vector-icons';

import { colors, radii, spacing } from '@/constants/theme';
import { useSyncStore } from '@/stores/syncStore';
import { formatRelative } from '@/utils/format';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface SyncStatusProps {
  /** When set, renders a "Sync now" action (dashboard/sync screens). */
  onSyncNow?: () => void;
  syncDisabled?: boolean;
}

/**
 * Combined connectivity + sync indicator:
 * ONLINE / OFFLINE / SYNCING / SYNC COMPLETE / SYNC ERROR,
 * with pending counts, last sync time and a pulsing dot while syncing.
 */
export function SyncStatus({ onSyncNow, syncDisabled = false }: SyncStatusProps) {
  const networkStatus = useSyncStore((s) => s.networkStatus);
  const syncState = useSyncStore((s) => s.syncState);
  const pendingCount = useSyncStore((s) => s.pendingCount);
  const failedCount = useSyncStore((s) => s.failedCount);
  const lastSyncedAt = useSyncStore((s) => s.lastSyncedAt);

  const { label, tone } = deriveStatus(networkStatus, syncState, failedCount, pendingCount);
  const isSyncing = syncState === 'syncing';
  const showSyncButton = onSyncNow !== undefined && pendingCount + failedCount > 0;

  const pulse = useAnimatedValue(1);

  useEffect(() => {
    if (!isSyncing) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 520, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 520, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [isSyncing, pulse]);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons
          name={networkStatus === 'online' ? 'sunny' : 'cloud-offline'}
          size={20}
          color={networkStatus === 'online' ? colors.sunDeep : colors.offline}
        />
        {isSyncing && <Animated.View style={[styles.pulseDot, { opacity: pulse }]} />}
        <StatusBadge label={label} tone={tone} />
        <View style={styles.flex} />
        {showSyncButton && (
          <Pressable
            onPress={onSyncNow}
            disabled={syncDisabled || isSyncing}
            style={({ pressed }) => [
              styles.syncButton,
              (syncDisabled || isSyncing) && styles.syncButtonDisabled,
              pressed && styles.syncButtonPressed,
            ]}
            accessibilityLabel="Sync now"
          >
            <Text style={styles.syncButtonText}>{isSyncing ? 'Syncing…' : 'Sync now'}</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.meta}>
        {pendingCount + failedCount > 0
          ? `${pendingCount + failedCount} change${pendingCount + failedCount === 1 ? '' : 's'} waiting to sync`
          : 'All changes synced'}
        {lastSyncedAt !== null ? ` · Last sync ${formatRelative(lastSyncedAt)}` : ''}
      </Text>
    </View>
  );
}

function deriveStatus(
  networkStatus: 'online' | 'offline' | 'unknown',
  syncState: 'idle' | 'syncing' | 'done' | 'error',
  failedCount: number,
  pendingCount: number,
): { label: string; tone: BadgeTone } {
  if (networkStatus === 'offline') {
    return { label: 'OFFLINE', tone: 'neutral' };
  }
  if (syncState === 'syncing') {
    return { label: 'SYNCING', tone: 'info' };
  }
  if (syncState === 'error' || failedCount > 0) {
    return { label: 'SYNC ERROR', tone: 'danger' };
  }
  if (syncState === 'done' && pendingCount === 0) {
    return { label: 'SYNC COMPLETE', tone: 'success' };
  }
  if (networkStatus === 'online') {
    return { label: 'ONLINE', tone: 'success' };
  }
  return { label: 'CHECKING…', tone: 'neutral' };
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  flex: {
    flex: 1,
  },
  syncButton: {
    backgroundColor: colors.sun,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
  },
  syncButtonDisabled: {
    opacity: 0.5,
  },
  syncButtonPressed: {
    backgroundColor: colors.sunDeep,
  },
  syncButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  meta: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textTertiary,
  },
});

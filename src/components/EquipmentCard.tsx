import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import {
  equipmentStatusLabel,
  equipmentTypeIcon,
  equipmentTypeLabel,
  syncStatusLabel,
} from '@/constants/domain';
import { colors, radii, spacing } from '@/constants/theme';
import type { Equipment, EquipmentStatus, SyncStatus } from '@/types';
import { PressableCard } from './PressableCard';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface EquipmentCardProps {
  equipment: Equipment;
  /** Stable callback passed down from the list screen. */
  onPress: (equipmentId: string) => void;
  /** Animate the entrance for the first page of rows. */
  animateIn?: boolean;
  entranceDelay?: number;
}

function statusTone(status: EquipmentStatus): BadgeTone {
  switch (status) {
    case 'operational':
      return 'success';
    case 'maintenance':
      return 'warning';
    case 'faulty':
      return 'danger';
    case 'offline':
      return 'neutral';
  }
}

function statusAccent(status: EquipmentStatus): string {
  switch (status) {
    case 'operational':
      return colors.success;
    case 'maintenance':
      return colors.sun;
    case 'faulty':
      return colors.danger;
    case 'offline':
      return colors.offline;
  }
}

function syncTone(syncStatus: SyncStatus): BadgeTone {
  switch (syncStatus) {
    case 'synced':
      return 'neutral';
    case 'pending':
    case 'syncing':
      return 'warning';
    case 'failed':
      return 'danger';
  }
}

/** Memoized virtualized-list row for equipment records (10k+ per site). */
export const EquipmentCard = React.memo(function EquipmentCard({
  equipment,
  onPress,
  animateIn = false,
  entranceDelay = 0,
}: EquipmentCardProps) {
  return (
    <PressableCard
      onPress={() => onPress(equipment.id)}
      animateIn={animateIn}
      entranceDelay={entranceDelay}
      accessibilityLabel={`${equipment.name}, ${equipmentStatusLabel(equipment.status)}`}
    >
      <View style={styles.card}>
        <View style={[styles.accent, { backgroundColor: statusAccent(equipment.status) }]} />
        <View style={styles.iconWrap}>
          <Ionicons name={equipmentTypeIcon(equipment.type)} size={20} color={colors.sunDeep} />
        </View>
        <View style={styles.body}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {equipment.name}
            </Text>
            <StatusBadge
              label={equipmentStatusLabel(equipment.status)}
              tone={statusTone(equipment.status)}
            />
          </View>
          <Text style={styles.meta} numberOfLines={1}>
            {equipmentTypeLabel(equipment.type)} · SN {equipment.serialNumber}
          </Text>
          <View style={styles.footer}>
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={13} color={colors.textTertiary} />
              <Text style={styles.location} numberOfLines={1}>
                {equipment.location}
              </Text>
            </View>
            {equipment.syncStatus !== 'synced' && (
              <StatusBadge
                label={syncStatusLabel(equipment.syncStatus)}
                tone={syncTone(equipment.syncStatus)}
              />
            )}
          </View>
        </View>
      </View>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  accent: {
    width: 4,
  },
  iconWrap: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sunSoft,
  },
  body: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  name: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  locationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  location: {
    flex: 1,
    fontSize: 12,
    color: colors.textTertiary,
  },
});

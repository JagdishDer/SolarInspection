import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { equipmentTypeIcon, equipmentTypeLabel, syncStatusLabel } from '@/constants/domain';
import { colors, radii, spacing } from '@/constants/theme';
import type { InspectionItemWithEquipment, ItemCondition, SyncStatus } from '@/types';
import { PressableCard } from './PressableCard';
import { StatusBadge, type BadgeTone } from './StatusBadge';

interface ChecklistItemProps {
  item: InspectionItemWithEquipment;
  /** Stable callback passed down from the list screen. */
  onPress: (item: InspectionItemWithEquipment) => void;
  /** Animate the entrance for the first page of rows. */
  animateIn?: boolean;
  entranceDelay?: number;
}

function conditionTone(condition: ItemCondition): BadgeTone {
  switch (condition) {
    case 'good':
      return 'success';
    case 'warning':
      return 'warning';
    case 'critical':
      return 'danger';
  }
}

function conditionColor(condition: ItemCondition): string {
  switch (condition) {
    case 'good':
      return colors.success;
    case 'warning':
      return colors.sun;
    case 'critical':
      return colors.danger;
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

/**
 * Memoized row for one equipment checklist entry. Shows inspection state
 * at a glance: not inspected / good / warning / critical.
 */
export const ChecklistItem = React.memo(function ChecklistItem({
  item,
  onPress,
  animateIn = false,
  entranceDelay = 0,
}: ChecklistItemProps) {
  const inspected = item.condition !== null;

  return (
    <PressableCard
      onPress={() => onPress(item)}
      animateIn={animateIn}
      entranceDelay={entranceDelay}
      accessibilityLabel={`${item.equipmentName}, ${inspected ? `condition ${item.condition}` : 'not inspected'}`}
    >
      <View style={styles.card}>
        <View style={[styles.iconWrap, inspected && item.condition !== null && { backgroundColor: colors.surface }]}>
          <Ionicons
            name={inspected && item.condition !== null ? 'checkmark-circle' : equipmentTypeIcon(item.equipmentType)}
            size={22}
            color={
              !inspected
                ? colors.textTertiary
                : item.condition === 'good'
                  ? colors.success
                  : item.condition === 'warning'
                    ? colors.sunDeep
                    : colors.danger
            }
          />
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {item.equipmentName}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {equipmentTypeLabel(item.equipmentType)} · SN {item.equipmentSerial}
          </Text>
          <View style={styles.badgeRow}>
            {inspected && item.condition !== null ? (
              <StatusBadge label={item.condition} tone={conditionTone(item.condition)} />
            ) : (
              <StatusBadge label="Not inspected" tone="neutral" />
            )}
            {item.syncStatus !== 'synced' && (
              <StatusBadge label={syncStatusLabel(item.syncStatus)} tone={syncTone(item.syncStatus)} />
            )}
          </View>
        </View>

        <View style={styles.chevronWrap}>
          <Ionicons name="chevron-forward" size={18} color={inspected && item.condition !== null ? conditionColor(item.condition) : colors.textTertiary} />
        </View>
      </View>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.sunSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textTertiary,
  },
  badgeRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chevronWrap: {
    paddingRight: spacing.xs,
  },
});

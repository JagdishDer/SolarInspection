import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatDateTime } from "@/utils/format";
import { inspectionStatusLabel, syncStatusLabel } from "@/constants/domain";
import { colors, radii, spacing } from "@/constants/theme";
import type { InspectionStatus, InspectionWithSite, SyncStatus } from "@/types";
import { PressableCard } from "./PressableCard";
import { ProgressBar } from "./ProgressBar";
import { StatusBadge, type BadgeTone } from "./StatusBadge";

interface InspectionCardProps {
  inspection: InspectionWithSite;
  itemCount: number;
  completedCount: number;
  /** Stable callback passed down from the list screen. */
  onPress: (inspectionId: string) => void;
  /** Animate the entrance for the first page of rows. */
  animateIn?: boolean;
  entranceDelay?: number;
}

function statusTone(status: InspectionStatus): BadgeTone {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "info";
    case "draft":
      return "neutral";
  }
}

function statusAccent(status: InspectionStatus): string {
  switch (status) {
    case "completed":
      return colors.success;
    case "in_progress":
      return colors.sun;
    case "draft":
      return colors.offline;
  }
}

function syncTone(syncStatus: SyncStatus): BadgeTone {
  switch (syncStatus) {
    case "synced":
      return "neutral";
    case "pending":
    case "syncing":
      return "warning";
    case "failed":
      return "danger";
  }
}

/** Memoized virtualized-list row for inspections. */
export const InspectionCard = React.memo(function InspectionCard({
  inspection,
  itemCount,
  completedCount,
  onPress,
  animateIn = false,
  entranceDelay = 0,
}: InspectionCardProps) {
  return (
    <PressableCard
      onPress={() => onPress(inspection.id)}
      animateIn={animateIn}
      entranceDelay={entranceDelay}
      accessibilityLabel={`Inspection at ${
        inspection.siteName
      }, ${inspectionStatusLabel(inspection.status)}`}
    >
      <View style={styles.card}>
        <View
          style={[
            styles.accent,
            { backgroundColor: statusAccent(inspection.status) },
          ]}
        />
        <View style={styles.body}>
          <View style={styles.header}>
            <Text style={styles.site} numberOfLines={1}>
              {inspection.siteName}
            </Text>
            <StatusBadge
              label={inspectionStatusLabel(inspection.status)}
              tone={statusTone(inspection.status)}
            />
          </View>

          <Text style={styles.meta}>
            {formatDateTime(inspection.startedAt)} · Inspector{" "}
            {inspection.inspectorId}
          </Text>

          <View style={styles.progressRow}>
            <ProgressBar value={completedCount} total={itemCount} />
            <Text style={styles.progressText}>
              {completedCount}/{itemCount} items
            </Text>
          </View>

          {inspection.syncStatus !== "synced" && (
            <View style={styles.syncRow}>
              <StatusBadge
                label={syncStatusLabel(inspection.syncStatus)}
                tone={syncTone(inspection.syncStatus)}
              />
            </View>
          )}
        </View>
      </View>
    </PressableCard>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: "hidden",
  },
  accent: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  site: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  progressText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textSecondary,
    minWidth: 64,
    textAlign: "right",
  },
  syncRow: {
    marginTop: spacing.sm,
    flexDirection: "row",
  },
});

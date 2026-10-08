import React, { useCallback, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { AppButton } from "@/components/AppButton";
import { ChecklistItem } from "@/components/ChecklistItem";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SafeScreen } from "@/components/SafeScreen";
import { SolarBackdrop } from '@/components/SolarBackdrop';
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { inspectionStatusLabel, syncStatusLabel } from "@/constants/domain";
import { colors, listMargins, radii, spacing } from "@/constants/theme";
import * as inspectionItemRepository from "@/repositories/inspectionItemRepository";
import * as inspectionRepository from "@/repositories/inspectionRepository";
import { getCurrentCoordinates } from "@/services/location/locationService";
import { syncService } from "@/services/sync/syncService";
import { useSyncStore } from "@/stores/syncStore";
import { formatCoord, formatDateTime, formatPercent } from "@/utils/format";
import type {
  InspectionItemWithEquipment,
  InspectionStatus,
  SyncStatus,
} from "@/types";
import type { InspectionDetail } from "@/repositories/inspectionRepository";

export default function InspectionDetailScreen() {
  const params = useLocalSearchParams<{ inspectionId: string }>();
  const inspectionId = params.inspectionId ?? "";

  const [detail, setDetail] = useState<InspectionDetail | null>(null);
  const [items, setItems] = useState<InspectionItemWithEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const networkStatus = useSyncStore((s) => s.networkStatus);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const [inspectionDetail, checklistItems] = await Promise.all([
        inspectionRepository.getDetail(inspectionId),
        inspectionItemRepository.getByInspection(inspectionId),
      ]);
      if (inspectionDetail === null) {
        setError("Inspection not found");
        setDetail(null);
      } else {
        setDetail(inspectionDetail);
      }
      setItems(checklistItems);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load inspection"
      );
    } finally {
      setLoading(false);
    }
  }, [inspectionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onComplete = useCallback((): void => {
    if (detail === null) return;
    const completed = detail.completedCount;
    const total = detail.itemCount;

    Alert.alert(
      "Complete inspection",
      completed < total
        ? `${completed} of ${total} checklist items are filled. Complete anyway?`
        : "All checklist items are filled. Complete this inspection?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          style: "default",
          onPress: () => {
            setCompleting(true);
            // Location is best-effort: never blocks completion.
            getCurrentCoordinates()
              .then((coordinates) =>
                inspectionRepository.completeInspection({
                  inspectionId,
                  notes: detail.notes,
                  latitude: coordinates?.latitude ?? null,
                  longitude: coordinates?.longitude ?? null,
                })
              )
              .then(() => useSyncStore.getState().refreshCounts())
              .then(() => {
                if (networkStatus === "online") {
                  void syncService.syncNow("manual");
                }
              })
              .then(() => load())
              .catch((err: unknown) => {
                Alert.alert(
                  "Could not complete inspection",
                  err instanceof Error ? err.message : "Unknown database error"
                );
              })
              .finally(() => setCompleting(false));
          },
        },
      ]
    );
  }, [detail, inspectionId, networkStatus, load]);

  // Stable identities so memoized rows only re-render when their data changes.
  const handleOpenItem = useCallback(
    (item: InspectionItemWithEquipment): void => {
      router.push(
        `/equipment/${item.equipmentId}?inspectionId=${inspectionId}&itemId=${item.id}`
      );
    },
    [inspectionId]
  );

  const renderItem = useCallback(
    ({ item, index }: { item: InspectionItemWithEquipment; index: number }) => (
      <ChecklistItem
        item={item}
        onPress={handleOpenItem}
        animateIn={index < 10}
        entranceDelay={index * 35}
      />
    ),
    [handleOpenItem]
  );

  if (loading) {
    return <LoadingState label="Loading inspection…" />;
  }

  if (error !== null || detail === null) {
    return (
      <SafeScreen>
        <ErrorState
          message={error ?? "Inspection not found"}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </SafeScreen>
    );
  }

  const isInProgress = detail.status === "in_progress";

  return (
    <SafeScreen>
      <SolarBackdrop variant="calm" />
      <FlashList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <OfflineBanner />
            <View style={styles.headerCard}>
              <View style={styles.headerTop}>
                <Text style={styles.siteName}>{detail.siteName}</Text>
                <StatusBadge
                  label={inspectionStatusLabel(
                    detail.status as InspectionStatus
                  )}
                  tone={detail.status === "completed" ? "success" : "info"}
                />
              </View>
              <Text style={styles.meta}>
                Started {formatDateTime(detail.startedAt)}
                {detail.completedAt !== null
                  ? ` · Completed ${formatDateTime(detail.completedAt)}`
                  : ""}
              </Text>
              <Text style={styles.meta}>Inspector {detail.inspectorId}</Text>
              {(detail.latitude !== null || detail.longitude !== null) && (
                <Text style={styles.meta}>
                  GPS {formatCoord(detail.latitude)},{" "}
                  {formatCoord(detail.longitude)}
                </Text>
              )}

              <View style={styles.progressSection}>
                <View style={styles.progressRow}>
                  <Text style={styles.progressLabel}>Checklist progress</Text>
                  <Text style={styles.progressValue}>
                    {detail.completedCount}/{detail.itemCount} ·{" "}
                    {formatPercent(detail.completedCount, detail.itemCount)}
                  </Text>
                </View>
                <ProgressBar
                  value={detail.completedCount}
                  total={detail.itemCount}
                />
              </View>

              {detail.notes.length > 0 && (
                <Text style={styles.notes}>{detail.notes}</Text>
              )}

              {detail.syncStatus !== "synced" && (
                <View style={styles.syncRow}>
                  <StatusBadge
                    label={syncStatusLabel(detail.syncStatus as SyncStatus)}
                    tone={detail.syncStatus === "failed" ? "danger" : "warning"}
                  />
                </View>
              )}
            </View>

            <Text style={styles.sectionTitle}>
              Checklist ({detail.itemCount})
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="list-outline"
            title="No checklist items"
            message="This inspection has no equipment attached."
          />
        }
        ListFooterComponent={
          isInProgress ? (
            <View style={styles.completeFooter}>
              <AppButton
                label="Complete inspection"
                onPress={onComplete}
                loading={completing}
                variant="primary"
              />
            </View>
          ) : (
            <View style={styles.footerSpace} />
          )
        }
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: listMargins.horizontal,
  },
  listContent: {
    paddingBottom: listMargins.bottom,
    gap: listMargins.cardGap,
    marginHorizontal: listMargins.horizontal,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  siteName: {
    flex: 1,
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  progressSection: {
    marginTop: spacing.lg,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  notes: {
    marginTop: spacing.lg,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radii.sm,
    padding: spacing.md,
  },
  syncRow: {
    marginTop: spacing.md,
    flexDirection: "row",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  completeFooter: {
    paddingVertical: spacing.lg,
  },
  footerSpace: {
    height: spacing.md,
  },
});

import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SafeScreen } from "@/components/SafeScreen";
import { SolarBackdrop } from '@/components/SolarBackdrop';
import { StatusBadge, type BadgeTone } from "@/components/StatusBadge";
import { SyncStatus } from "@/components/SyncStatus";
import { colors, listMargins, radii, spacing } from "@/constants/theme";
import * as syncQueueRepository from "@/repositories/syncQueueRepository";
import { syncService } from "@/services/sync/syncService";
import { useSyncStore } from "@/stores/syncStore";
import type { SyncEntityType, SyncOperation } from "@/types";
import { formatDateTime } from "@/utils/format";

interface QueueRow {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  attempts: number;
  status: string;
  lastError: string | null;
  updatedAt: string;
}

const ENTITY_LABEL: Record<SyncEntityType, string> = {
  inspection: "Inspection",
  inspection_item: "Checklist item",
  photo: "Photo",
  equipment: "Equipment",
  site: "Site",
};

function statusTone(status: string, attempts: number): BadgeTone {
  if (status === "failed") return "danger";
  return attempts > 0 ? "warning" : "info";
}

export default function SyncScreen() {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const networkStatus = useSyncStore((s) => s.networkStatus);
  const syncState = useSyncStore((s) => s.syncState);
  const failedCount = useSyncStore((s) => s.failedCount);
  const pendingCount = useSyncStore((s) => s.pendingCount);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setRows(await syncQueueRepository.listActive());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load sync queue"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Keep the queue list fresh while sync runs (external store subscription).
  useEffect(() => {
    return useSyncStore.subscribe((state, prev) => {
      if (
        state.syncState !== prev.syncState &&
        (state.syncState === "done" || state.syncState === "error")
      ) {
        void load();
      }
    });
  }, [load]);

  const isSyncing = syncState === "syncing";

  const onSyncNow = useCallback((): void => {
    void syncService.syncNow("manual").then(() => load());
  }, [load]);

  const onRetryFailed = useCallback((): void => {
    void syncService.retryFailed().then(() => load());
  }, [load]);

  if (loading) {
    return <LoadingState label="Loading sync status…" />;
  }

  if (error !== null) {
    return (
      <SafeScreen>
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <SolarBackdrop variant="calm" />
      <FlashList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.rowTitle}>
                {ENTITY_LABEL[item.entityType]} · {item.operation}
              </Text>
              <StatusBadge
                label={
                  item.status === "failed"
                    ? "Failed"
                    : `Pending (try ${item.attempts + 1})`
                }
                tone={statusTone(item.status, item.attempts)}
              />
            </View>
            <Text style={styles.rowMeta} numberOfLines={1}>
              ID {item.entityId} · Updated {formatDateTime(item.updatedAt)}
            </Text>
            {item.lastError !== null && (
              <Text style={styles.rowError} numberOfLines={2}>
                {item.lastError}
              </Text>
            )}
          </View>
        )}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <OfflineBanner />
            <SyncStatus
              onSyncNow={onSyncNow}
              syncDisabled={isSyncing || networkStatus === "offline"}
            />
            {failedCount > 0 && (
              <AppButton
                label={`Retry ${failedCount} failed change${
                  failedCount === 1 ? "" : "s"
                }`}
                onPress={onRetryFailed}
                variant="secondary"
                disabled={isSyncing}
                style={styles.retryButton}
              />
            )}
            <Text style={styles.sectionTitle}>
              Sync queue ({pendingCount + failedCount})
            </Text>
            <Text style={styles.sectionHint}>
              Changes made offline are queued here and uploaded automatically
              when a connection is available. Failed entries back off
              exponentially and are retried on demand.
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="cloud-done-outline"
            title="Queue is empty"
            message="All local changes have been synchronized."
          />
        }
        ListFooterComponent={<View style={styles.footerSpace} />}
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
    marginHorizontal: listMargins.horizontal,
    marginTop: spacing.md,
  },
  retryButton: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionHint: {
    marginBottom: spacing.md,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textTertiary,
  },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 12,
    marginTop: 12,
  },
  rowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: colors.text,
  },
  rowMeta: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textTertiary,
  },
  rowError: {
    marginTop: 6,
    fontSize: 12,
    color: colors.danger,
  },
  footerSpace: {
    height: spacing.md,
  },
});

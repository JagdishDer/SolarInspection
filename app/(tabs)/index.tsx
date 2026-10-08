import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

import { OfflineBanner } from "@/components/OfflineBanner";
import { SafeScreen } from "@/components/SafeScreen";
import { SolarBackdrop } from "@/components/SolarBackdrop";
import { SyncStatus } from "@/components/SyncStatus";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { InspectionCard } from "@/components/InspectionCard";
import { LoadingState } from "@/components/LoadingState";
import { colors, radii, spacing } from "@/constants/theme";
import * as equipmentRepository from "@/repositories/equipmentRepository";
import * as inspectionRepository from "@/repositories/inspectionRepository";
import * as siteRepository from "@/repositories/siteRepository";
import { syncService } from "@/services/sync/syncService";
import { useSyncStore } from "@/stores/syncStore";
import type { DashboardStats, InspectionListRow } from "@/types";
import { formatCount } from "@/utils/format";

interface DashboardData {
  stats: DashboardStats;
  recentInspections: InspectionListRow[];
}

export default function DashboardScreen() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const pendingCount = useSyncStore((s) => s.pendingCount);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const [siteCount, equipmentCount, inspectionCounts, recentInspections] =
        await Promise.all([
          siteRepository.countSites(),
          equipmentRepository.countAll(),
          inspectionRepository.countAll(),
          inspectionRepository.listInspections({ limit: 5 }),
        ]);
      setData({
        stats: {
          siteCount,
          equipmentCount,
          inspectionCount: inspectionCounts.total,
          completedInspectionCount: inspectionCounts.completed,
        },
        recentInspections,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Refresh list data when a sync run completes (row badges may change).
  // Subscribing to the store keeps this outside the render/effect cycle.
  useEffect(() => {
    return useSyncStore.subscribe((state, prev) => {
      if (state.syncState === "done" && prev.syncState !== "done") void load();
    });
  }, [load]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const onSyncNow = useCallback((): void => {
    void syncService.syncNow("manual");
  }, []);

  const handleOpenInspection = useCallback((inspectionId: string): void => {
    router.push(`/inspections/${inspectionId}`);
  }, []);

  if (loading) {
    return <LoadingState label="Loading dashboard…" />;
  }

  if (error !== null || data === null) {
    return (
      <SafeScreen>
        <ErrorState
          message={error ?? "Dashboard unavailable"}
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
      <SolarBackdrop variant="hero" />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <Text style={styles.title}>Field Inspections</Text>
        <Text style={styles.subtitle}>Solar farm inspection toolkit</Text>

        <OfflineBanner />

        <SyncStatus onSyncNow={onSyncNow} />

        <View style={styles.statsGrid}>
          <StatCard
            icon="business"
            label="Sites"
            value={formatCount(data.stats.siteCount)}
            tint={colors.primary}
            tintSoft={colors.skySoft}
          />
          <StatCard
            icon="sunny"
            label="Equipment"
            value={formatCount(data.stats.equipmentCount)}
            tint={colors.sunDeep}
            tintSoft={colors.sunSoft}
          />
          <StatCard
            icon="clipboard"
            label="Inspections"
            value={formatCount(data.stats.inspectionCount)}
            tint={colors.success}
            tintSoft={colors.successSoft}
          />
          <StatCard
            icon="checkmark-circle"
            label="Completed"
            value={formatCount(data.stats.completedInspectionCount)}
            tint={colors.primary}
            tintSoft={colors.skySoft}
          />
        </View>

        <View style={styles.actionsRow}>
          <Link href="/inspections/create" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="add-circle" size={20} color={colors.primary} />
              <Text style={styles.actionText}>New inspection</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/sites" asChild>
            <Pressable
              style={({ pressed }) => [
                styles.actionButton,
                pressed && styles.pressed,
              ]}
            >
              <Ionicons name="map-outline" size={20} color={colors.primary} />
              <Text style={styles.actionText}>Browse sites</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent inspections</Text>
          {pendingCount > 0 && (
            <Text style={styles.sectionBadge}>
              {formatCount(pendingCount)} pending
            </Text>
          )}
        </View>

        {data.recentInspections.length === 0 ? (
          <EmptyState
            icon="clipboard-outline"
            title="No inspections yet"
            message="Create your first inspection from a solar farm site."
          />
        ) : (
          <View style={styles.inspectionList}>
            {data.recentInspections.map((inspection, index) => (
              <InspectionCard
                key={inspection.id}
                inspection={inspection}
                itemCount={inspection.itemCount}
                completedCount={inspection.completedCount}
                onPress={handleOpenInspection}
                animateIn={index < 5}
                entranceDelay={index * 60}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeScreen>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
  tintSoft,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  tint: string;
  tintSoft: string;
}) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: tintSoft }]}>
        <Ionicons name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    marginTop: 2,
    marginBottom: spacing.lg,
    fontSize: 13,
    color: colors.textTertiary,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  statCard: {
    flexBasis: "47%",
    flexGrow: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.xs,
  },
  statIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.textTertiary,
  },
  actionsRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    minHeight: 48,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.primarySoft,
  },
  pressed: {
    opacity: 0.7,
  },
  actionText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.primary,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  sectionBadge: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.warning,
  },
  inspectionList: {
    gap: spacing.md,
  },
});

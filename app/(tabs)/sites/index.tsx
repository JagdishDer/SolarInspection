import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { LoadingState } from "@/components/LoadingState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { PressableCard } from "@/components/PressableCard";
import { SafeScreen } from "@/components/SafeScreen";
import { SolarBackdrop } from "@/components/SolarBackdrop";
import { StatusBadge } from "@/components/StatusBadge";
import { colors, listMargins, radii, spacing } from "@/constants/theme";
import * as siteRepository from "@/repositories/siteRepository";
import type { SiteWithStats } from "@/types";
import { formatCapacity, formatCount } from "@/utils/format";

export default function SitesScreen() {
  const [sites, setSites] = useState<SiteWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      setSites(await siteRepository.getAllWithStats());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sites");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  if (loading) {
    return <LoadingState label="Loading sites…" />;
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
      <OfflineBanner />
      <FlashList
        data={sites}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <PressableCard
            style={styles.card}
            onPress={() => router.push(`/sites/${item.id}`)}
            animateIn={index < 4}
            entranceDelay={index * 60}
            accessibilityLabel={`Open ${item.name}`}
          >
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}>
                <Ionicons name="sunny" size={22} color={colors.sunDeep} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.location} numberOfLines={1}>
                  {item.location}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textTertiary}
              />
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>
                  {formatCapacity(item.capacityMw)}
                </Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statValue}>
                  {formatCount(item.equipmentCount)} assets
                </Text>
              </View>
              <View style={styles.flex} />
              <StatusBadge
                label={item.syncStatus === "synced" ? "Synced" : "Pending"}
                tone={item.syncStatus === "synced" ? "success" : "warning"}
              />
            </View>
          </PressableCard>
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <EmptyState
            icon="business-outline"
            title="No sites"
            message="Sites are provisioned with the initial data set."
          />
        }
        ListFooterComponent={<View style={styles.footerSpace} />}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingBottom: listMargins.bottom,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginTop: spacing.md,
    marginHorizontal: listMargins.horizontal,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    backgroundColor: colors.sunSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.text,
  },
  location: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textTertiary,
  },
  statsRow: {
    marginTop: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statChip: {
    backgroundColor: colors.skySoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  statValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.primary,
  },
  flex: {
    flex: 1,
  },
  footerSpace: {
    height: spacing.md,
  },
});

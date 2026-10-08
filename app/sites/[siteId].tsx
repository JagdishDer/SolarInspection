import React, { useCallback, useRef, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { FlashList } from "@shopify/flash-list";

import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { EquipmentCard } from "@/components/EquipmentCard";
import { ErrorState } from "@/components/ErrorState";
import { FilterBar } from "@/components/FilterBar";
import { LoadingState } from "@/components/LoadingState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SafeScreen } from "@/components/SafeScreen";
import { SolarBackdrop } from "@/components/SolarBackdrop";
import { SearchBar } from "@/components/SearchBar";
import {
  EQUIPMENT_PAGE_SIZE,
  EQUIPMENT_STATUS_FILTER,
  EQUIPMENT_TYPE_FILTER,
  SEARCH_DEBOUNCE_MS,
} from "@/constants/domain";
import { colors, listMargins, spacing } from "@/constants/theme";
import * as equipmentRepository from "@/repositories/equipmentRepository";
import * as siteRepository from "@/repositories/siteRepository";
import { useDebouncedCallback } from "@/utils/debounce";
import { formatCapacity, formatCount } from "@/utils/format";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentType,
  SiteWithStats,
} from "@/types";

export default function SiteDetailScreen() {
  const params = useLocalSearchParams<{ siteId: string }>();
  const siteId = params.siteId ?? "";

  const [site, setSite] = useState<SiteWithStats | null>(null);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [totalMatching, setTotalMatching] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EquipmentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "all">(
    "all"
  );

  // Guards against overlapping appends when onEndReached fires repeatedly.
  const requestIdRef = useRef(0);

  const commitSearch = useDebouncedCallback((text: string) => {
    setQuery(text);
  }, SEARCH_DEBOUNCE_MS);

  const onSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);
      commitSearch(text);
    },
    [commitSearch]
  );

  const loadInitial = useCallback(async (): Promise<void> => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setError(null);
      const [siteRow, firstPage] = await Promise.all([
        siteRepository.getByIdWithStats(siteId),
        equipmentRepository.listPaged({
          siteId,
          search: query,
          type: typeFilter,
          status: statusFilter,
          limit: EQUIPMENT_PAGE_SIZE,
          offset: 0,
        }),
      ]);
      if (requestIdRef.current !== requestId) return;
      const count = await equipmentRepository.countMatching({
        siteId,
        search: query,
        type: typeFilter,
        status: statusFilter,
      });
      if (requestIdRef.current !== requestId) return;
      setSite(siteRow);
      setEquipment(firstPage);
      setTotalMatching(count);
    } catch (err) {
      if (requestIdRef.current === requestId) {
        setError(
          err instanceof Error ? err.message : "Failed to load equipment"
        );
      }
    } finally {
      if (requestIdRef.current === requestId) setLoading(false);
    }
  }, [siteId, query, typeFilter, statusFilter]);

  useFocusEffect(
    useCallback(() => {
      void loadInitial();
    }, [loadInitial])
  );

  const loadMore = useCallback(async (): Promise<void> => {
    if (loadingMore || loading) return;
    const alreadyLoaded = equipment.length;
    if (alreadyLoaded >= totalMatching) return;

    setLoadingMore(true);
    try {
      const nextPage = await equipmentRepository.listPaged({
        siteId,
        search: query,
        type: typeFilter,
        status: statusFilter,
        limit: EQUIPMENT_PAGE_SIZE,
        offset: alreadyLoaded,
      });
      setEquipment((prev) => [...prev, ...nextPage]);
    } catch {
      // Keep existing page content; pull-to-refresh can recover.
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    loading,
    equipment.length,
    totalMatching,
    siteId,
    query,
    typeFilter,
    statusFilter,
  ]);

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await loadInitial();
    setRefreshing(false);
  }, [loadInitial]);

  const onOpenEquipment = useCallback((equipmentId: string): void => {
    router.push(`/equipment/${equipmentId}`);
  }, []);

  const onNewInspection = useCallback((): void => {
    router.push(`/inspections/create?siteId=${siteId}`);
  }, [siteId]);

  const renderItem = useCallback(
    ({ item, index }: { item: Equipment; index: number }) => (
      <View style={styles.card}>
        <EquipmentCard
          equipment={item}
          onPress={onOpenEquipment}
          animateIn={index < 8}
          entranceDelay={index * 35}
        />
      </View>
    ),
    [onOpenEquipment]
  );

  if (loading) {
    return <LoadingState label="Loading site…" />;
  }

  if (error !== null || site === null) {
    return (
      <SafeScreen>
        <ErrorState
          message={error ?? "Site not found"}
          onRetry={() => {
            setLoading(true);
            void loadInitial();
          }}
        />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <SolarBackdrop variant="calm" />
      <FlashList
        data={equipment}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        onEndReachedThreshold={0.5}
        onEndReached={() => void loadMore()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.siteHeader}>
              <Text style={styles.siteName}>{site.name}</Text>
              <Text style={styles.siteMeta}>
                {site.location} · {formatCapacity(site.capacityMw)}
              </Text>
              <Text style={styles.siteCount}>
                Showing {formatCount(Math.min(equipment.length, totalMatching))}{" "}
                of {formatCount(totalMatching)} assets
              </Text>
            </View>
            <OfflineBanner />
            <AppButton
              label="New inspection at this site"
              onPress={onNewInspection}
              style={styles.cta}
            />
            <View style={styles.controls}>
              <SearchBar
                value={searchText}
                onChangeText={onSearchChange}
                placeholder="Search name or serial number"
              />
              <FilterBar
                options={EQUIPMENT_TYPE_FILTER}
                selected={typeFilter}
                onSelect={setTypeFilter}
              />
              <FilterBar
                options={EQUIPMENT_STATUS_FILTER}
                selected={statusFilter}
                onSelect={setStatusFilter}
              />
            </View>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            icon="search-outline"
            title="No equipment found"
            message="Try a different search term or filter."
          />
        }
        ListFooterComponent={
          loadingMore ? (
            <Text style={styles.footer}>Loading more…</Text>
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
  siteHeader: {
    paddingTop: spacing.lg,
    marginBottom: spacing.md,
  },
  siteName: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.text,
  },
  siteMeta: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textSecondary,
  },
  siteCount: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textTertiary,
  },
  cta: {
    marginBottom: spacing.md,
  },
  controls: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  footer: {
    paddingVertical: spacing.lg,
    textAlign: "center",
    fontSize: 13,
    color: colors.textTertiary,
  },
  footerSpace: {
    height: spacing.md,
  },
  card: {
    marginBottom: listMargins.cardGap,
  },
});

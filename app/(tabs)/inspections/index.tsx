import React, { useCallback, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Link, router, useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FilterBar } from "@/components/FilterBar";
import { InspectionCard } from "@/components/InspectionCard";
import { LoadingState } from "@/components/LoadingState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SafeScreen } from "@/components/SafeScreen";
import { SolarBackdrop } from "@/components/SolarBackdrop";
import { SearchBar } from "@/components/SearchBar";
import {
  EQUIPMENT_PAGE_SIZE,
  INSPECTION_STATUS_FILTER,
  SEARCH_DEBOUNCE_MS,
} from "@/constants/domain";
import { colors, listMargins, spacing } from "@/constants/theme";
import * as inspectionRepository from "@/repositories/inspectionRepository";
import { useDebouncedCallback } from "@/utils/debounce";
import type { InspectionListRow, InspectionStatus } from "@/types";
import { AppButton } from "@/components/AppButton";

export default function InspectionsScreen() {
  const [rows, setRows] = useState<InspectionListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<InspectionStatus | "all">("all");

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

  // Offset lives in a ref so `load` identity (and thus the focus effect)
  // does not change as pages are appended.
  const offsetRef = useRef(0);

  const load = useCallback(
    async (mode: "initial" | "more"): Promise<void> => {
      try {
        setError(null);
        const offset = mode === "initial" ? 0 : offsetRef.current;
        const page = await inspectionRepository.listInspections({
          status,
          search: query,
          limit: EQUIPMENT_PAGE_SIZE,
          offset,
        });
        if (mode === "initial") {
          setRows(page);
          offsetRef.current = page.length;
        } else {
          setRows((prev) => [...prev, ...page]);
          offsetRef.current += page.length;
        }
        setHasMore(page.length === EQUIPMENT_PAGE_SIZE);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load inspections"
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [query, status]
  );

  // useFocusEffect re-runs whenever its callback identity changes, so
  // filter/search changes and screen focus both trigger a fresh load.
  useFocusEffect(
    useCallback(() => {
      void load("initial");
    }, [load])
  );

  const onRefresh = useCallback(async (): Promise<void> => {
    setRefreshing(true);
    await load("initial");
    setRefreshing(false);
  }, [load]);

  const onEndReached = useCallback((): void => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    void load("more").finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, load]);

  // Stable identities so memoized rows only re-render when their data changes.
  const handleOpenInspection = useCallback((inspectionId: string): void => {
    router.push(`/inspections/${inspectionId}`);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: { item: InspectionListRow; index: number }) => (
      <View key={item?.id} style={styles.card}>
        <InspectionCard
          inspection={item}
          itemCount={item.itemCount}
          completedCount={item.completedCount}
          onPress={handleOpenInspection}
          animateIn={index < 8}
          entranceDelay={index * 40}
        />
      </View>
    ),
    [handleOpenInspection]
  );

  if (loading) {
    return <LoadingState label="Loading inspections…" />;
  }

  if (error !== null) {
    return (
      <SafeScreen>
        <ErrorState
          message={error}
          onRetry={() => {
            setLoading(true);
            void load("initial");
          }}
        />
      </SafeScreen>
    );
  }

  return (
    <SafeScreen>
      <SolarBackdrop variant="calm" />
      <View style={styles.controls}>
        <OfflineBanner />
        <SearchBar
          value={searchText}
          onChangeText={onSearchChange}
          placeholder="Search site or inspector"
        />
        <FilterBar
          options={INSPECTION_STATUS_FILTER}
          selected={status}
          onSelect={(value) => setStatus(value)}
        />
      </View>

      <FlashList
        data={rows}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <EmptyState
            icon="clipboard-outline"
            title="No inspections found"
            message="Adjust your filters or create a new inspection."
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

      <AppButton
        style={styles.fab}
        label="+"
        onPress={() => router.push("/inspections/create")}
      />
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    marginHorizontal: listMargins.horizontal,
  },
  controls: {
    paddingTop: spacing.md,
    marginHorizontal: listMargins.horizontal,
  },
  listContent: {
    paddingBottom: listMargins.bottom + 64,
    gap: listMargins.cardGap,
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
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  fabPressed: {
    backgroundColor: colors.primaryPressed,
  },
  card: {
    marginTop: listMargins.cardGap,
    marginHorizontal: listMargins.horizontal,
  },
});

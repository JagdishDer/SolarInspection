import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/AppButton";
import { EmptyState } from "@/components/EmptyState";
import { ErrorState } from "@/components/ErrorState";
import { FilterBar } from "@/components/FilterBar";
import { LoadingState } from "@/components/LoadingState";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SafeScreen } from "@/components/SafeScreen";
import { PressableCard } from '@/components/PressableCard';
import { SolarBackdrop } from '@/components/SolarBackdrop';
import { SearchBar } from "@/components/SearchBar";
import {
  EQUIPMENT_PAGE_SIZE,
  EQUIPMENT_STATUS_FILTER,
  EQUIPMENT_TYPE_FILTER,
  SEARCH_DEBOUNCE_MS,
} from "@/constants/domain";
import { colors, listMargins, radii, spacing } from "@/constants/theme";
import * as equipmentRepository from "@/repositories/equipmentRepository";
import * as inspectionRepository from "@/repositories/inspectionRepository";
import * as siteRepository from "@/repositories/siteRepository";
import { useInspectionStore } from "@/stores/inspectionStore";
import { useUiStore } from "@/stores/uiStore";
import { useDebouncedCallback } from "@/utils/debounce";
import { formatCount } from "@/utils/format";
import type {
  Equipment,
  EquipmentStatus,
  EquipmentType,
  SiteWithStats,
} from "@/types";

export default function CreateInspectionScreen() {
  const params = useLocalSearchParams<{ siteId?: string }>();
  const initialSiteId =
    typeof params.siteId === "string" ? params.siteId : null;

  const storedInspectorName = useUiStore((s) => s.inspectorName);

  const [sites, setSites] = useState<SiteWithStats[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(
    initialSiteId
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [inspectorName, setInspectorName] = useState(storedInspectorName);
  const [notes, setNotes] = useState("");

  const [searchText, setSearchText] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<EquipmentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<EquipmentStatus | "all">(
    "all"
  );
  const [equipment, setEquipment] = useState<Equipment[]>([]);

  const selectedEquipmentIds = useInspectionStore(
    (s) => s.selectedEquipmentIds
  );
  const toggleSelectedEquipment = useInspectionStore(
    (s) => s.toggleSelectedEquipment
  );
  const clearSelection = useInspectionStore((s) => s.clearSelection);
  const creating = useInspectionStore((s) => s.creating);
  const setCreating = useInspectionStore((s) => s.setCreating);

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

  // Clear any stale selection when entering the create flow.
  useFocusEffect(
    useCallback(() => {
      if (!creating) clearSelection();
    }, [clearSelection, creating])
  );

  useEffect(() => {
    let cancelled = false;
    siteRepository
      .getAllWithStats()
      .then((rows) => {
        if (!cancelled) {
          setSites(rows);
          if (selectedSiteId === null && rows.length > 0) {
            setSelectedSiteId(rows[0]?.id ?? null);
          }
        }
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Failed to load sites");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // Run once on mount; site choice is user-driven afterwards.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedSiteId === null) return;
    let cancelled = false;
    equipmentRepository
      .listPaged({
        siteId: selectedSiteId,
        search: query,
        type: typeFilter,
        status: statusFilter,
        limit: EQUIPMENT_PAGE_SIZE * 4,
        offset: 0,
      })
      .then((rows) => {
        if (!cancelled) setEquipment(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Failed to load equipment"
          );
      });
    return () => {
      cancelled = true;
    };
  }, [selectedSiteId, query, typeFilter, statusFilter]);

  const selectedSite = useMemo(
    () => sites.find((s) => s.id === selectedSiteId) ?? null,
    [sites, selectedSiteId]
  );

  const toggleEquipment = useCallback(
    (equipmentId: string) => {
      toggleSelectedEquipment(equipmentId);
    },
    [toggleSelectedEquipment]
  );

  const renderItem = useCallback(
    ({ item }: { item: Equipment }) => (
      <SelectableEquipmentRow equipment={item} onToggle={toggleEquipment} />
    ),
    [toggleEquipment]
  );

  const onCreate = useCallback((): void => {
    const trimmedInspector = inspectorName.trim();
    if (selectedSiteId === null) {
      Alert.alert("Missing site", "Choose a solar farm for this inspection.");
      return;
    }
    if (trimmedInspector.length === 0) {
      Alert.alert("Missing inspector", "Enter the inspector name or id.");
      return;
    }
    if (selectedEquipmentIds.length === 0) {
      Alert.alert(
        "No equipment selected",
        "Select at least one asset to inspect."
      );
      return;
    }

    setCreating(true);
    useUiStore.getState().setInspectorName(trimmedInspector);
    inspectionRepository
      .createInspection({
        siteId: selectedSiteId,
        inspectorId: trimmedInspector,
        notes: notes.trim(),
        equipmentIds: selectedEquipmentIds,
      })
      .then((inspectionId) => {
        clearSelection();
        // Fresh data replaces the create screen in history.
        router.replace(`/inspections/${inspectionId}`);
      })
      .catch((err: unknown) => {
        Alert.alert(
          "Could not create inspection",
          err instanceof Error ? err.message : "Unknown database error"
        );
      })
      .finally(() => {
        setCreating(false);
      });
  }, [
    inspectorName,
    selectedSiteId,
    selectedEquipmentIds,
    notes,
    setCreating,
    clearSelection,
  ]);

  if (loading) {
    return <LoadingState label="Preparing inspection…" />;
  }

  if (error !== null) {
    return (
      <SafeScreen>
        <ErrorState
          message={error}
          onRetry={() => router.back()}
          retryLabel="Go back"
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
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <OfflineBanner />
            <Text style={styles.sectionLabel}>Solar farm</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.siteChips}
            >
              {sites.map((site) => {
                const active = site.id === selectedSiteId;
                return (
                  <Pressable
                    key={site.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => setSelectedSiteId(site.id)}
                    style={[styles.siteChip, active && styles.siteChipActive]}
                  >
                    <Text
                      style={[
                        styles.siteChipText,
                        active && styles.siteChipTextActive,
                      ]}
                    >
                      {site.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.sectionLabel}>Inspector</Text>
            <TextInput
              style={styles.input}
              value={inspectorName}
              onChangeText={setInspectorName}
              placeholder="Name or employee id"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
            />

            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Purpose, weather, special instructions…"
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />

            <View style={styles.equipmentHeader}>
              <Text style={styles.sectionLabel}>
                Equipment to inspect
                {selectedSite !== null ? ` — ${selectedSite.name}` : ""}
              </Text>
              <Text style={styles.selectedCount}>
                {formatCount(selectedEquipmentIds.length)} selected
              </Text>
            </View>
            <View style={styles.controls}>
              <SearchBar
                value={searchText}
                onChangeText={onSearchChange}
                placeholder="Search equipment"
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
            message="Adjust search or filters to select equipment."
          />
        }
      />
      <View style={styles.createFooter}>
        <AppButton
          label={`Start inspection (${selectedEquipmentIds.length})`}
          onPress={onCreate}
          loading={creating}
          disabled={
            selectedSiteId === null || selectedEquipmentIds.length === 0
          }
        />
      </View>
    </SafeScreen>
  );
}

/**
 * Memoized selection row. It subscribes to its own slice of the selection
 * state, so toggling one checkbox re-renders exactly two rows (the one
 * selected and the one deselected) instead of the entire list.
 */
const SelectableEquipmentRow = React.memo(function SelectableEquipmentRow({
  equipment,
  onToggle,
}: {
  equipment: Equipment;
  onToggle: (equipmentId: string) => void;
}) {
  const selected = useInspectionStore((s) =>
    s.selectedEquipmentIds.includes(equipment.id)
  );
  const handlePress = useCallback(() => {
    onToggle(equipment.id);
  }, [onToggle, equipment.id]);

  return (
    <PressableCard
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      style={styles.equipmentRow}
      onPress={handlePress}
    >
      <Ionicons
        name={selected ? "checkbox" : "square-outline"}
        size={22}
        color={selected ? colors.primary : colors.textTertiary}
      />
      <View style={styles.equipmentBody}>
        <Text style={styles.equipmentName} numberOfLines={1}>
          {equipment.name}
        </Text>
        <Text style={styles.equipmentMeta} numberOfLines={1}>
          SN {equipment.serialNumber} · {equipment.location}
        </Text>
      </View>
    </PressableCard>
  );
});

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
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    flexShrink: 1,
  },
  siteChips: {
    gap: spacing.sm,
    paddingVertical: 2,
  },
  siteChip: {
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
  },
  siteChipActive: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary,
  },
  siteChipText: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  siteChipTextActive: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 48,
    fontSize: 15,
    color: colors.text,
  },
  notesInput: {
    minHeight: 88,
    paddingTop: spacing.md,
    textAlignVertical: "top",
  },
  equipmentHeader: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  selectedCount: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.primary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  controls: {
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  equipmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: listMargins.cardGap,
  },
  pressed: {
    backgroundColor: colors.surfaceMuted,
  },
  equipmentBody: {
    flex: 1,
  },
  equipmentName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  equipmentMeta: {
    marginTop: 2,
    fontSize: 12,
    color: colors.textTertiary,
  },
  createFooter: {
    paddingVertical: spacing.lg,
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.background,
    paddingHorizontal: listMargins.horizontal,
  },
});

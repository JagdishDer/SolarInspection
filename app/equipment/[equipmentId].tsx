import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { ErrorState } from '@/components/ErrorState';
import { LoadingState } from '@/components/LoadingState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { OptionGroup } from '@/components/OptionGroup';
import { SafeScreen } from '@/components/SafeScreen';
import { SolarBackdrop } from '@/components/SolarBackdrop';
import { PhotoGrid } from '@/components/PhotoGrid';
import { StatusBadge } from '@/components/StatusBadge';
import {
  CHECK_GRADE_OPTIONS,
  CONDITION_OPTIONS,
  equipmentTypeLabel,
  syncStatusLabel,
} from '@/constants/domain';
import { colors, radii, spacing } from '@/constants/theme';
import * as equipmentRepository from '@/repositories/equipmentRepository';
import * as inspectionItemRepository from '@/repositories/inspectionItemRepository';
import * as photoRepository from '@/repositories/photoRepository';
import { deletePhoto } from '@/services/photo/photoService';
import { syncService } from '@/services/sync/syncService';
import { useSyncStore } from '@/stores/syncStore';
import { useUiStore } from '@/stores/uiStore';
import { formatDateTime, formatTemperature } from '@/utils/format';
import type {
  CheckGrade,
  Equipment,
  InspectionItemWithEquipment,
  InspectionPhoto,
  ItemCondition,
} from '@/types';

interface FormState {
  condition: ItemCondition | null;
  physicalDamage: CheckGrade | null;
  wiring: CheckGrade | null;
  cleanliness: CheckGrade | null;
  thermalText: string;
  notes: string;
}

function formFromItem(item: InspectionItemWithEquipment | null): FormState {
  return {
    condition: item?.condition ?? null,
    physicalDamage: item?.physicalDamage ?? null,
    wiring: item?.wiring ?? null,
    cleanliness: item?.cleanliness ?? null,
    thermalText: item?.thermalCondition === null || item === null ? '' : String(item.thermalCondition),
    notes: item?.notes ?? '',
  };
}

/**
 * Equipment screen. With `inspectionId` + `itemId` params it is the
 * checklist form for one checklist entry; without them it is a read-only
 * equipment profile with inspection history.
 */
export default function EquipmentScreen() {
  const params = useLocalSearchParams<{
    equipmentId: string;
    inspectionId?: string;
    itemId?: string;
  }>();
  const equipmentId = params.equipmentId ?? '';
  const itemId = typeof params.itemId === 'string' ? params.itemId : null;
  const inspectionId = typeof params.inspectionId === 'string' ? params.inspectionId : null;

  const [item, setItem] = useState<InspectionItemWithEquipment | null>(null);
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [photos, setPhotos] = useState<InspectionPhoto[]>([]);
  const [history, setHistory] = useState<InspectionItemWithEquipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormState>(formFromItem(null));
  const [dirty, setDirty] = useState(false);

  const photoCaptureCount = useUiStore((s) => s.photoCaptureCount);

  const load = useCallback(async (): Promise<void> => {
    try {
      setError(null);

      if (itemId !== null) {
        // Checklist mode: the form for one inspection item.
        const itemDetail = await inspectionItemRepository.getDetail(itemId);
        if (itemDetail === null) {
          setError('Checklist item not found');
          setItem(null);
        } else {
          setItem(itemDetail);
          setForm(formFromItem(itemDetail));
          setDirty(false);
        }
        setPhotos(await photoRepository.getByItem(itemId));
        setEquipment(null);
        setHistory([]);
      } else {
        // Profile mode: equipment details + recent results.
        const equipmentRow = await equipmentRepository.getById(equipmentId);
        if (equipmentRow === null) {
          setError('Equipment not found');
          setEquipment(null);
        } else {
          setEquipment(equipmentRow);
          setHistory(await inspectionItemRepository.getRecentForEquipment(equipmentId));
        }
        setItem(null);
        setPhotos([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load equipment');
    } finally {
      setLoading(false);
    }
  }, [itemId, equipmentId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // The camera screen bumps photoCaptureCount after persisting a photo.
  useEffect(() => {
    if (itemId === null) return;
    photoRepository
      .getByItem(itemId)
      .then(setPhotos)
      .catch(() => {
        // Keep the previous list on transient errors.
      });
  }, [photoCaptureCount, itemId]);

  const onDeletePhoto = useCallback(
    (photo: InspectionPhoto) => {
      deletePhoto(photo)
        .then(() => {
          if (itemId !== null) return photoRepository.getByItem(itemId);
          return [];
        })
        .then(setPhotos)
        .then(() => useSyncStore.getState().refreshCounts())
        .catch((err: unknown) => {
          Alert.alert(
            'Could not delete photo',
            err instanceof Error ? err.message : 'Unknown error',
          );
        });
    },
    [itemId],
  );

  const onAddPhoto = useCallback((): void => {
    if (inspectionId === null) return;
    router.push({
      pathname: '/camera',
      params: { inspectionId, ...(itemId !== null ? { inspectionItemId: itemId } : {}) },
    });
  }, [inspectionId, itemId]);

  const setField = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const canSave = useMemo(
    () => form.condition !== null && form.physicalDamage !== null && form.wiring !== null && form.cleanliness !== null,
    [form],
  );

  const thermalValue = useMemo(() => {
    if (form.thermalText.trim().length === 0) return null;
    const parsed = Number(form.thermalText);
    return Number.isFinite(parsed) ? parsed : NaN;
  }, [form.thermalText]);

  const onSave = useCallback((): void => {
    if (itemId === null || form.condition === null || form.physicalDamage === null || form.wiring === null || form.cleanliness === null) {
      return;
    }
    if (Number.isNaN(thermalValue)) {
      Alert.alert('Invalid thermal reading', 'Enter a numeric temperature in °C or leave the field empty.');
      return;
    }

    setSaving(true);
    inspectionItemRepository
      .saveResult({
        itemId,
        condition: form.condition,
        physicalDamage: form.physicalDamage,
        wiring: form.wiring,
        cleanliness: form.cleanliness,
        thermalCondition: thermalValue,
        notes: form.notes.trim(),
      })
      .then(() => useSyncStore.getState().refreshCounts())
      .then(() => {
        if (useSyncStore.getState().networkStatus === 'online') {
          // Opportunistic upload; the queue guarantees delivery regardless.
          void syncService.syncNow('manual');
        }
      })
      .then(() => inspectionItemRepository.getDetail(itemId))
      .then((fresh) => {
        setItem(fresh);
        setForm(formFromItem(fresh));
        setDirty(false);
      })
      .catch((err: unknown) => {
        Alert.alert(
          'Could not save checklist',
          err instanceof Error ? err.message : 'Unknown database error',
        );
      })
      .finally(() => setSaving(false));
  }, [itemId, form, thermalValue]);

  if (loading) {
    return <LoadingState label="Loading equipment…" />;
  }

  if (error !== null || (item === null && equipment === null)) {
    return (
      <SafeScreen>
        <ErrorState
          message={error ?? 'Equipment not found'}
          onRetry={() => {
            setLoading(true);
            void load();
          }}
        />
      </SafeScreen>
    );
  }

  const isChecklistMode = item !== null;

  return (
    <SafeScreen>
      <SolarBackdrop variant="calm" />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <OfflineBanner />

      {item !== null ? (
        <View style={styles.headerCard}>
          <View style={styles.headerTop}>
            <Text style={styles.equipmentName}>{item.equipmentName}</Text>
            {item.condition !== null && (
              <StatusBadge
                label={item.condition}
                tone={
                  item.condition === 'good'
                    ? 'success'
                    : item.condition === 'warning'
                      ? 'warning'
                      : 'danger'
                }
              />
            )}
          </View>
          <Text style={styles.meta}>
            {equipmentTypeLabel(item.equipmentType)} · SN {item.equipmentSerial}
          </Text>
          <Text style={styles.meta}>Last updated {formatDateTime(item.updatedAt)}</Text>
          {item.syncStatus !== 'synced' && (
            <View style={styles.syncRow}>
              <StatusBadge
                label={syncStatusLabel(item.syncStatus)}
                tone={item.syncStatus === 'failed' ? 'danger' : 'warning'}
              />
            </View>
          )}
        </View>
      ) : (
        equipment !== null && (
          <View style={styles.headerCard}>
            <Text style={styles.equipmentName}>{equipment.name}</Text>
            <Text style={styles.meta}>
              {equipmentTypeLabel(equipment.type)} · SN {equipment.serialNumber}
            </Text>
            <Text style={styles.meta}>{equipment.location}</Text>
            <Text style={styles.meta}>
              Status: {equipment.status} · Updated {formatDateTime(equipment.updatedAt)}
            </Text>
          </View>
        )
      )}

      {isChecklistMode && (
        <>
          <OptionGroup
            label="Overall condition"
            options={CONDITION_OPTIONS}
            value={form.condition}
            onSelect={(value) => setField('condition', value)}
          />
          <OptionGroup
            label="Physical damage"
            options={CHECK_GRADE_OPTIONS}
            value={form.physicalDamage}
            onSelect={(value) => setField('physicalDamage', value)}
          />
          <OptionGroup
            label="Wiring"
            options={CHECK_GRADE_OPTIONS}
            value={form.wiring}
            onSelect={(value) => setField('wiring', value)}
          />
          <OptionGroup
            label="Cleanliness"
            options={CHECK_GRADE_OPTIONS}
            value={form.cleanliness}
            onSelect={(value) => setField('cleanliness', value)}
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Thermal reading (°C, optional)</Text>
            <TextInput
              style={styles.input}
              value={form.thermalText}
              onChangeText={(text) => setField('thermalText', text.replace(/[^0-9.\-]/g, ''))}
              placeholder="e.g. 42.5"
              placeholderTextColor={colors.textTertiary}
              keyboardType="numbers-and-punctuation"
              returnKeyType="done"
            />
            <Text style={styles.fieldHint}>
              Current value: {formatTemperature(Number.isNaN(thermalValue) ? null : thermalValue)}
            </Text>
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Notes</Text>
            <TextInput
              style={[styles.input, styles.notesInput]}
              value={form.notes}
              onChangeText={(text) => setField('notes', text)}
              placeholder="Findings, recommendations, parts needed…"
              placeholderTextColor={colors.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Photo evidence</Text>
            <PhotoGrid
              photos={photos}
              onAddPhoto={onAddPhoto}
              onDeletePhoto={onDeletePhoto}
            />
          </View>

          <AppButton
            label={dirty ? 'Save checklist' : 'Saved'}
            onPress={onSave}
            loading={saving}
            disabled={!canSave}
            style={styles.saveButton}
          />
          {!canSave && (
            <Text style={styles.saveHint}>Choose condition, damage, wiring and cleanliness to save.</Text>
          )}
        </>
      )}

      {!isChecklistMode && history.length > 0 && (
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Recent inspection results</Text>
          {history.map((h) => (
            <View key={h.id} style={styles.historyRow}>
              <Text style={styles.historyTitle}>
                {h.condition !== null ? h.condition : '—'} · {formatDateTime(h.updatedAt)}
              </Text>
              {h.notes.length > 0 && <Text style={styles.historyNotes}>{h.notes}</Text>}
            </View>
          ))}
        </View>
      )}
      </ScrollView>
    </SafeScreen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  equipmentName: {
    flex: 1,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    marginTop: spacing.xs,
    fontSize: 13,
    color: colors.textSecondary,
  },
  syncRow: {
    marginTop: spacing.md,
    flexDirection: 'row',
  },
  fieldGroup: {
    marginTop: spacing.lg,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  fieldHint: {
    marginTop: spacing.xs,
    fontSize: 12,
    color: colors.textTertiary,
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
  },
  saveButton: {
    marginTop: spacing.xl,
  },
  saveHint: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  historyRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  historyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  historyNotes: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
  },
});

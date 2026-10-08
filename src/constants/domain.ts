import type { Ionicons } from '@expo/vector-icons';

import type {
  CheckGrade,
  EquipmentStatus,
  EquipmentType,
  InspectionStatus,
  ItemCondition,
  SyncStatus,
  UploadStatus,
} from '@/types';

export interface Option<T extends string> {
  value: T;
  label: string;
}

export const EQUIPMENT_TYPE_OPTIONS: Option<EquipmentType>[] = [
  { value: 'panel', label: 'Solar Panel' },
  { value: 'inverter', label: 'Inverter' },
  { value: 'transformer', label: 'Transformer' },
  { value: 'combiner_box', label: 'Combiner Box' },
  { value: 'electrical', label: 'Electrical' },
  { value: 'other', label: 'Other' },
];

export const EQUIPMENT_TYPE_FILTER: Option<EquipmentType | 'all'>[] = [
  { value: 'all', label: 'All types' },
  ...EQUIPMENT_TYPE_OPTIONS,
];

export const EQUIPMENT_STATUS_FILTER: Option<EquipmentStatus | 'all'>[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'operational', label: 'Operational' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'faulty', label: 'Faulty' },
  { value: 'offline', label: 'Offline' },
];

export const INSPECTION_STATUS_FILTER: Option<InspectionStatus | 'all'>[] = [
  { value: 'all', label: 'All' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'draft', label: 'Draft' },
];

export const CONDITION_OPTIONS: Option<ItemCondition>[] = [
  { value: 'good', label: 'Good' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];

export const CHECK_GRADE_OPTIONS: Option<CheckGrade>[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

/** Max attempts before a queue entry is parked as failed (manual retry resets). */
export const MAX_SYNC_ATTEMPTS = 5;

/** Exponential backoff base, in ms: 2^attempt * BASE, capped at CAP. */
export const SYNC_BACKOFF_BASE_MS = 15_000;
export const SYNC_BACKOFF_MAX_MS = 120_000;

/** Batch size for queue processing. */
export const SYNC_BATCH_SIZE = 25;

export const EQUIPMENT_PAGE_SIZE = 50;

export const SEARCH_DEBOUNCE_MS = 300;

export const PHOTO_MAX_WIDTH = 1280;
export const PHOTO_COMPRESS_QUALITY = 0.7;

export function equipmentTypeLabel(type: EquipmentType): string {
  return EQUIPMENT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}


/** Icon shown on equipment cards/checklist rows, per equipment type. */
export function equipmentTypeIcon(type: EquipmentType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'panel':
      return 'sunny-outline';
    case 'inverter':
      return 'swap-horizontal-outline';
    case 'transformer':
      return 'server-outline';
    case 'combiner_box':
      return 'layers-outline';
    case 'electrical':
      return 'flash-outline';
    case 'other':
      return 'cube-outline';
  }
}

export function equipmentStatusLabel(status: EquipmentStatus): string {
  switch (status) {
    case 'operational':
      return 'Operational';
    case 'maintenance':
      return 'Maintenance';
    case 'faulty':
      return 'Faulty';
    case 'offline':
      return 'Offline';
  }
}

export function inspectionStatusLabel(status: InspectionStatus): string {
  switch (status) {
    case 'draft':
      return 'Draft';
    case 'in_progress':
      return 'In progress';
    case 'completed':
      return 'Completed';
  }
}

export function syncStatusLabel(status: SyncStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending sync';
    case 'syncing':
      return 'Syncing';
    case 'synced':
      return 'Synced';
    case 'failed':
      return 'Sync failed';
  }
}

export function uploadStatusLabel(status: UploadStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending upload';
    case 'uploading':
      return 'Uploading';
    case 'uploaded':
      return 'Uploaded';
    case 'failed':
      return 'Upload failed';
  }
}

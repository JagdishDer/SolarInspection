/**
 * Domain entity types. These mirror the SQLite schema 1:1 (camelCase columns)
 * so rows can be used directly without mapping overhead.
 */

export type EquipmentType =
  | 'panel'
  | 'inverter'
  | 'transformer'
  | 'combiner_box'
  | 'electrical'
  | 'other';

export type EquipmentStatus = 'operational' | 'maintenance' | 'faulty' | 'offline';

export type InspectionStatus = 'draft' | 'in_progress' | 'completed';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'failed';

export type UploadStatus = 'pending' | 'uploading' | 'uploaded' | 'failed';

export type ItemCondition = 'good' | 'warning' | 'critical';

/** Grade used for physical damage / wiring / cleanliness checks. */
export type CheckGrade = 'good' | 'fair' | 'poor';

export interface Site {
  id: string;
  name: string;
  location: string;
  capacityMw: number;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Equipment {
  id: string;
  siteId: string;
  name: string;
  type: EquipmentType;
  serialNumber: string;
  location: string;
  status: EquipmentStatus;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface Inspection {
  id: string;
  siteId: string;
  inspectorId: string;
  startedAt: string;
  completedAt: string | null;
  status: InspectionStatus;
  notes: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
  version: number;
}

export interface InspectionItem {
  id: string;
  inspectionId: string;
  equipmentId: string;
  condition: ItemCondition | null;
  physicalDamage: CheckGrade | null;
  wiring: CheckGrade | null;
  cleanliness: CheckGrade | null;
  thermalCondition: number | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
  syncStatus: SyncStatus;
}

export interface InspectionPhoto {
  id: string;
  inspectionId: string;
  inspectionItemId: string | null;
  localUri: string;
  remoteUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  uploadStatus: UploadStatus;
}

export type SyncEntityType =
  | 'inspection'
  | 'inspection_item'
  | 'photo'
  | 'equipment'
  | 'site';

export type SyncOperation = 'create' | 'update';

export type SyncQueueStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface SyncQueueItem {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  /** JSON-serialized payload snapshot taken when the mutation was queued. */
  payload: string;
  attempts: number;
  status: SyncQueueStatus;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Aggregate progress for an inspection's checklist. */
export interface InspectionProgress {
  total: number;
  completed: number;
}

export interface DashboardStats {
  siteCount: number;
  equipmentCount: number;
  inspectionCount: number;
  completedInspectionCount: number;
}

export type InspectionWithSite = Inspection & { siteName: string };

export type InspectionListRow = InspectionWithSite & {
  itemCount: number;
  completedCount: number;
};

export type SiteWithStats = Site & { equipmentCount: number };

export type InspectionItemWithEquipment = InspectionItem & {
  equipmentName: string;
  equipmentType: EquipmentType;
  equipmentSerial: string;
};

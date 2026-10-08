import type {
  Equipment,
  Inspection,
  InspectionItem,
  InspectionPhoto,
} from './index';

/**
 * Payloads sent to the backend. They are the entity minus local-only
 * sync bookkeeping, carrying a client-generated id so every operation
 * is an idempotent upsert keyed by id.
 */

export type InspectionPayload = Omit<Inspection, 'syncStatus'>;
export type InspectionItemPayload = Omit<InspectionItem, 'syncStatus'>;
export type PhotoPayload = Omit<InspectionPhoto, 'uploadStatus'>;
export type EquipmentPayload = Omit<Equipment, 'syncStatus'>;

export interface PhotoUploadResult {
  remoteUrl: string;
}

/**
 * Transport-agnostic API contract. The mock client implements this today;
 * swapping in a real HTTP backend only requires another implementation.
 */
export interface ApiClient {
  upsertInspection(payload: InspectionPayload): Promise<void>;
  upsertInspectionItem(payload: InspectionItemPayload): Promise<void>;
  upsertPhoto(payload: PhotoPayload): Promise<PhotoUploadResult>;
  upsertEquipment(payload: EquipmentPayload): Promise<void>;
}

/** Standardized error thrown by any ApiClient implementation. */
export class ApiError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
  }
}

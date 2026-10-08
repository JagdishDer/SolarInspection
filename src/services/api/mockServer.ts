import { ApiError } from '@/types/api';
import type {
  ApiClient,
  EquipmentPayload,
  InspectionItemPayload,
  InspectionPayload,
  PhotoPayload,
  PhotoUploadResult,
} from '@/types/api';

function parseFailureRate(): number {
  const raw = process.env.EXPO_PUBLIC_MOCK_FAILURE_RATE;
  const parsed = raw === undefined ? NaN : Number(raw);
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 1) return parsed;
  return 0.2;
}

const FAILURE_RATE = parseFailureRate();
const MIN_LATENCY_MS = 250;
const MAX_LATENCY_MS = 850;

const FAILURE_MESSAGES = [
  'Mock server error: upstream timeout',
  'Mock server error: service temporarily unavailable (503)',
  'Mock server error: internal error (500)',
];

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface StoredRecord {
  id: string;
}

/** Last-write-wins timestamp used to ignore stale replays. */
interface VersionedRecord {
  updatedAt?: string;
  createdAt?: string;
}

/**
 * In-memory backend used for development and offline/sync testing.
 * Simulates realistic latency, validation, and an intermittent failure
 * rate so retry/backoff logic can be exercised without a real server.
 * Upserts are keyed by client-generated id => sync is idempotent.
 */
class MockSolarApi implements ApiClient {
  private readonly inspections = new Map<string, InspectionPayload>();
  private readonly inspectionItems = new Map<string, InspectionItemPayload>();
  private readonly photos = new Map<string, PhotoPayload>();
  private readonly equipment = new Map<string, EquipmentPayload>();

  /** Exposed for debugging/tests. */
  counts(): { inspections: number; items: number; photos: number; equipment: number } {
    return {
      inspections: this.inspections.size,
      items: this.inspectionItems.size,
      photos: this.photos.size,
      equipment: this.equipment.size,
    };
  }

  async upsertInspection(payload: InspectionPayload): Promise<void> {
    await this.request(() => {
      this.requireString(payload.id, 'id');
      this.requireString(payload.siteId, 'siteId');
      this.stored(this.inspections, payload, payload.updatedAt);
    });
  }

  async upsertInspectionItem(payload: InspectionItemPayload): Promise<void> {
    await this.request(() => {
      this.requireString(payload.id, 'id');
      this.requireString(payload.inspectionId, 'inspectionId');
      this.requireString(payload.equipmentId, 'equipmentId');
      this.stored(this.inspectionItems, payload, payload.updatedAt);
    });
  }

  async upsertPhoto(payload: PhotoPayload): Promise<PhotoUploadResult> {
    return this.request(() => {
      this.requireString(payload.id, 'id');
      this.requireString(payload.inspectionId, 'inspectionId');
      this.requireString(payload.localUri, 'localUri');
      this.stored(this.photos, payload, payload.createdAt);
      return { remoteUrl: `https://mock.cdn.solarfield.example/photos/${payload.id}.jpg` };
    });
  }

  async upsertEquipment(payload: EquipmentPayload): Promise<void> {
    await this.request(() => {
      this.requireString(payload.id, 'id');
      this.requireString(payload.siteId, 'siteId');
      this.stored(this.equipment, payload, payload.updatedAt);
    });
  }

  private stored<T extends StoredRecord & VersionedRecord>(
    map: Map<string, T>,
    record: T,
    updatedAt: string,
  ): void {
    const existing = map.get(record.id);
    // Last-write-wins by updatedAt; replays of older payloads are ignored.
    if (existing) {
      const existingVersion = existing.updatedAt ?? existing.createdAt ?? '';
      if (existingVersion > updatedAt) return;
    }
    map.set(record.id, record);
  }

  private requireString(value: unknown, field: string): void {
    if (typeof value !== 'string' || value.length === 0) {
      throw new ApiError(`Mock server: invalid payload, missing "${field}"`, 400);
    }
  }

  /** Shared pipeline: latency -> random failure -> handler. */
  private async request<T>(handler: () => T): Promise<T> {
    await delay(MIN_LATENCY_MS + Math.random() * (MAX_LATENCY_MS - MIN_LATENCY_MS));

    if (Math.random() < FAILURE_RATE) {
      const message = FAILURE_MESSAGES[Math.floor(Math.random() * FAILURE_MESSAGES.length)] ?? 'Mock server error';
      throw new ApiError(message, 500);
    }

    return handler();
  }
}

export const mockSolarApi = new MockSolarApi();

import { ApiError } from '@/types/api';
import type {
  ApiClient,
  EquipmentPayload,
  InspectionItemPayload,
  InspectionPayload,
  PhotoPayload,
  PhotoUploadResult,
} from '@/types/api';
import { mockSolarApi } from './mockServer';

const DEFAULT_API_URL = 'http://localhost:3000/api';
const REQUEST_TIMEOUT_MS = 15_000;

function resolveApiUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  return url && url.length > 0 ? url : DEFAULT_API_URL;
}

function isMockApiEnabled(): boolean {
  return process.env.EXPO_PUBLIC_USE_MOCK_API !== 'false';
}

/**
 * HTTP implementation of ApiClient. The backend contract is:
 *   PUT /inspections            body: InspectionPayload
 *   PUT /inspection-items       body: InspectionItemPayload
 *   PUT /equipment              body: EquipmentPayload
 *   POST /photos                body: PhotoPayload -> { remoteUrl: string }
 * All endpoints are idempotent upserts keyed by client-generated id.
 * (The photo binary upload is a backend concern and out of scope for the mock.)
 */
function createHttpApiClient(baseUrl: string): ApiClient {
  const url = (path: string): string => `${baseUrl.replace(/\/$/, '')}${path}`;

  async function postJson<TResponse>(path: string, body: unknown): Promise<TResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Network request failed';
      throw new ApiError(`Network error: ${message}`, 0);
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      throw new ApiError(`API error ${response.status}`, response.status);
    }

    try {
      return (await response.json()) as TResponse;
    } catch {
      throw new ApiError('Malformed API response: expected JSON body', 0);
    }
  }

  return {
    upsertInspection: (payload: InspectionPayload) => postJson<void>('/inspections', payload),
    upsertInspectionItem: (payload: InspectionItemPayload) =>
      postJson<void>('/inspection-items', payload),
    upsertPhoto: async (payload: PhotoPayload): Promise<PhotoUploadResult> => {
      const result = await postJson<Partial<PhotoUploadResult>>('/photos', payload);
      if (typeof result?.remoteUrl !== 'string' || result.remoteUrl.length === 0) {
        throw new ApiError('Malformed API response: missing remoteUrl', 0);
      }
      return { remoteUrl: result.remoteUrl };
    },
    upsertEquipment: (payload: EquipmentPayload) => postJson<void>('/equipment', payload),
  };
}

/**
 * The single ApiClient used by the sync service. Today it resolves to the
 * mock; setting EXPO_PUBLIC_USE_MOCK_API=false (plus EXPO_PUBLIC_API_URL)
 * switches to the real HTTP client without touching any other code.
 */
export const apiClient: ApiClient = isMockApiEnabled()
  ? mockSolarApi
  : createHttpApiClient(resolveApiUrl());

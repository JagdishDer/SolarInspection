import { ApiError } from '@/types/api';
import type {
  EquipmentPayload,
  InspectionItemPayload,
  InspectionPayload,
  PhotoPayload,
} from '@/types/api';
import type { SyncEntityType } from '@/types';
import type { SyncResult, SyncTrigger } from '@/types/sync';
import { SYNC_BATCH_SIZE } from '@/constants/domain';
import * as equipmentRepository from '@/repositories/equipmentRepository';
import * as inspectionItemRepository from '@/repositories/inspectionItemRepository';
import * as inspectionRepository from '@/repositories/inspectionRepository';
import * as photoRepository from '@/repositories/photoRepository';
import * as siteRepository from '@/repositories/siteRepository';
import * as syncQueueRepository from '@/repositories/syncQueueRepository';
import { useSyncStore } from '@/stores/syncStore';
import { nowIso } from '@/utils/format';
import { apiClient } from '@/services/api/client';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

interface PayloadShape {
  id: unknown;
}

function parsePayload<T extends PayloadShape>(
  raw: string,
  requiredFields: readonly string[],
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError('Malformed sync payload: invalid JSON', 0);
  }
  if (!isRecord(parsed) || typeof parsed.id !== 'string') {
    throw new ApiError('Malformed sync payload: missing id', 0);
  }
  for (const field of requiredFields) {
    if (parsed[field] === undefined) {
      throw new ApiError(`Malformed sync payload: missing "${field}"`, 0);
    }
  }
  return parsed as T;
}

/** Minimal structural checks before payloads cross the API boundary. */
const REQUIRED_FIELDS: Record<SyncEntityType, readonly string[]> = {
  inspection: ['siteId', 'inspectorId', 'startedAt'],
  inspection_item: ['inspectionId', 'equipmentId'],
  photo: ['inspectionId', 'localUri'],
  equipment: ['siteId', 'name'],
  site: ['name'],
};

/** How many queue entries to process between UI count refreshes. */
const COUNT_REFRESH_INTERVAL = 5;

/**
 * Drains the local sync queue to the backend.
 *
 * Guarantees:
 * - Only one run at a time (concurrent calls are coalesced).
 * - Entries process in createdAt order, in small batches.
 * - One failing entry never blocks the rest of the queue.
 * - Failures preserve the queue record with attempts + lastError and
 *   back off exponentially (gated by getDueBatch).
 * - Success deletes the queue entry and marks the entity synced, so an
 *   entry is uploaded exactly once (idempotent upserts make replays safe).
 * - Offline state stops the drain immediately; connectivity restoration
 *   or a manual action restarts it.
 */
class SyncService {
  private running = false;

  get isRunning(): boolean {
    return this.running;
  }

  async syncNow(trigger: SyncTrigger = 'manual'): Promise<SyncResult> {
    if (this.running) {
      return { processed: 0, succeeded: 0, failed: 0, remaining: -1, skipped: true };
    }
    this.running = true;

    const store = useSyncStore.getState();
    store.setSyncState('syncing');
    store.setSyncError(null);

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let lastError: string | null = null;
    let stoppedOffline = false;

    try {
      for (;;) {
        if (useSyncStore.getState().networkStatus === 'offline') {
          stoppedOffline = true;
          break;
        }

        const batch = await syncQueueRepository.getDueBatch(SYNC_BATCH_SIZE);
        if (batch.length === 0) break;

        for (const entry of batch) {
          if (useSyncStore.getState().networkStatus === 'offline') {
            // Roll the interrupted entry back to pending before stopping.
            await syncQueueRepository.markFailed(entry.id, entry.attempts, 'Sync interrupted: went offline');
            stoppedOffline = true;
            break;
          }

          await syncQueueRepository.markProcessing(entry.id);

          try {
            await this.processEntry(entry);
            await this.markEntitySynced(entry.entityType, entry.entityId);
            await syncQueueRepository.markDone(entry.id);
            succeeded += 1;
          } catch (error) {
            failed += 1;
            lastError = error instanceof Error ? error.message : 'Unknown sync error';
            await syncQueueRepository.markFailed(entry.id, entry.attempts, lastError);
          }

          processed += 1;
          // Throttle store updates: refreshing after every entry would
          // re-render subscribed UI (badges, banners) once per record.
          if (processed % COUNT_REFRESH_INTERVAL === 0) {
            await useSyncStore.getState().refreshCounts();
          }
        }

        if (stoppedOffline) break;
      }

      const counts = await syncQueueRepository.getCounts();
      const finalStore = useSyncStore.getState();
      finalStore.setCounts(counts);
      if (succeeded > 0) finalStore.setLastSyncedAt(nowIso());
      if (failed > 0) {
        finalStore.setSyncState('error');
        finalStore.setSyncError(lastError);
      } else {
        finalStore.setSyncState('done');
      }

      return {
        processed,
        succeeded,
        failed,
        remaining: counts.pending + counts.failed,
        stoppedReason: stoppedOffline ? 'offline' : 'complete',
      };
    } finally {
      this.running = false;
    }
  }

  /** Manual retry: un-parks failed entries, resets attempts, syncs now. */
  async retryFailed(): Promise<SyncResult> {
    await syncQueueRepository.resetFailed();
    await useSyncStore.getState().refreshCounts();
    return this.syncNow('manual');
  }

  private async processEntry(
    entry: syncQueueRepository.DueQueueRow,
  ): Promise<void> {
    const required = REQUIRED_FIELDS[entry.entityType] ?? ['id'];

    switch (entry.entityType) {
      case 'inspection': {
        const payload = parsePayload<InspectionPayload>(entry.payload, required);
        await apiClient.upsertInspection(payload);
        return;
      }
      case 'inspection_item': {
        const payload = parsePayload<InspectionItemPayload>(entry.payload, required);
        await apiClient.upsertInspectionItem(payload);
        return;
      }
      case 'photo': {
        const payload = parsePayload<PhotoPayload>(entry.payload, required);
        const result = await apiClient.upsertPhoto(payload);
        await photoRepository.markUploaded(payload.id, result.remoteUrl);
        return;
      }
      case 'equipment': {
        const payload = parsePayload<EquipmentPayload>(entry.payload, required);
        await apiClient.upsertEquipment(payload);
        return;
      }
      case 'site': {
        // Sites are provisioned by seed/backend pulls; queue entries are a
        // safety net for future write support.
        return;
      }
    }
  }

  private async markEntitySynced(
    entityType: SyncEntityType,
    entityId: string,
  ): Promise<void> {
    switch (entityType) {
      case 'inspection':
        await inspectionRepository.markSynced(entityId);
        return;
      case 'inspection_item':
        await inspectionItemRepository.markSynced(entityId);
        return;
      case 'photo':
        // uploadStatus is set in processEntry together with remoteUrl.
        return;
      case 'equipment':
        await equipmentRepository.markSynced(entityId);
        return;
      case 'site':
        await siteRepository.markSynced(entityId);
        return;
    }
  }
}

export const syncService = new SyncService();

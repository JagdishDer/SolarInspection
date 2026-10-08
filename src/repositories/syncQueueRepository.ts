import { getDatabase } from '@/database/db';
import type { SyncEntityType, SyncOperation } from '@/types';
import { MAX_SYNC_ATTEMPTS, SYNC_BACKOFF_BASE_MS, SYNC_BACKOFF_MAX_MS } from '@/constants/domain';
import { uuid } from '@/utils/uuid';
import { nowIso } from '@/utils/format';

export interface EnqueueInput {
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  /** JSON-serialized payload snapshot. */
  payload: string;
}

export interface QueueCounts {
  pending: number;
  failed: number;
}

/**
 * Coalescing: at most one pending entry per (entityType, entityId).
 * Re-queuing a pending/failed entity replaces its payload and resets
 * attempts, which keeps the queue small and avoids duplicate uploads.
 */
export async function enqueue(input: EnqueueInput): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();

  const existing = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM sync_queue
     WHERE entityType = ? AND entityId = ? AND status IN ('pending', 'failed')
     LIMIT 1`,
    [input.entityType, input.entityId],
  );

  if (existing) {
    await db.runAsync(
      `UPDATE sync_queue
       SET payload = ?, operation = ?, attempts = 0, status = 'pending', lastError = NULL, updatedAt = ?
       WHERE id = ?`,
      [input.payload, input.operation, now, existing.id],
    );
    return;
  }

  await db.runAsync(
    `INSERT INTO sync_queue
       (id, entityType, entityId, operation, payload, attempts, status, lastError, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, 0, 'pending', NULL, ?, ?)`,
    [uuid(), input.entityType, input.entityId, input.operation, input.payload, now, now],
  );
}

/** Exponential backoff: 2^attempts * BASE, capped. Attempt 0 is immediately due. */
export function backoffDelayMs(attempts: number): number {
  return Math.min(SYNC_BACKOFF_BASE_MS * 2 ** attempts, SYNC_BACKOFF_MAX_MS);
}

export interface DueQueueRow {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: string;
  attempts: number;
  updatedAt: string;
}

/**
 * Returns up to `limit` pending entries in queue order (createdAt ASC) that
 * are due for a retry according to their backoff schedule.
 */
export async function getDueBatch(limit: number): Promise<DueQueueRow[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    payload: string;
    attempts: number;
    updatedAt: string;
  }>(
    `SELECT id, entityType, entityId, operation, payload, attempts, updatedAt
     FROM sync_queue WHERE status = 'pending'
     ORDER BY createdAt ASC LIMIT ?`,
    [limit * 4],
  );

  const now = Date.now();
  const due: DueQueueRow[] = [];
  for (const row of rows) {
    const nextAttemptAt = Date.parse(row.updatedAt) + backoffDelayMs(row.attempts);
    if (Number.isNaN(nextAttemptAt) || nextAttemptAt <= now) {
      due.push(row);
      if (due.length >= limit) break;
    }
  }
  return due;
}

export async function markProcessing(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'processing', updatedAt = ? WHERE id = ?`,
    [nowIso(), id],
  );
}

/** Success: the entry is consumed. Entity rows are marked synced separately. */
export async function markDone(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
}

/** Failure: increments attempts, preserves the record, parks it after MAX. */
export async function markFailed(id: string, attempts: number, error: string): Promise<void> {
  const db = await getDatabase();
  const nextAttempts = attempts + 1;
  const status = nextAttempts >= MAX_SYNC_ATTEMPTS ? 'failed' : 'pending';
  await db.runAsync(
    `UPDATE sync_queue
     SET attempts = ?, status = ?, lastError = ?, updatedAt = ?
     WHERE id = ?`,
    [nextAttempts, status, error.slice(0, 500), nowIso(), id],
  );
}

/** App-restart safety: entries caught mid-flight become pending again. */
export async function recoverInterrupted(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue SET status = 'pending', updatedAt = ? WHERE status = 'processing'`,
    [nowIso()],
  );
}

export async function getCounts(): Promise<QueueCounts> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ pending: number; failed: number }>(
    `SELECT
       SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
     FROM sync_queue`,
  );
  return { pending: row?.pending ?? 0, failed: row?.failed ?? 0 };
}

/** Rows shown on the sync screen (pending + failed), oldest first. */
export async function listActive(limit = 100): Promise<
  {
    id: string;
    entityType: SyncEntityType;
    entityId: string;
    operation: SyncOperation;
    attempts: number;
    status: string;
    lastError: string | null;
    updatedAt: string;
  }[]
> {
  const db = await getDatabase();
  return db.getAllAsync(
    `SELECT id, entityType, entityId, operation, attempts, status, lastError, updatedAt
     FROM sync_queue
     WHERE status IN ('pending', 'failed')
     ORDER BY createdAt ASC LIMIT ?`,
    [limit],
  );
}

/** Manual retry: reset failed entries back to pending with fresh attempts. */
export async function resetFailed(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending', attempts = 0, lastError = NULL, updatedAt = ?
     WHERE status = 'failed'`,
    [nowIso()],
  );
}

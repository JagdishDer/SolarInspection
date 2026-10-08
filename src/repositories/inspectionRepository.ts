import { getDatabase } from '@/database/db';
import type {
  Inspection,
  InspectionStatus,
  InspectionWithSite,
  SyncOperation,
} from '@/types';
import { uuid } from '@/utils/uuid';
import { nowIso } from '@/utils/format';
import { enqueue } from './syncQueueRepository';

const INSPECTION_COLUMNS =
  'id, siteId, inspectorId, startedAt, completedAt, status, notes, latitude, longitude, createdAt, updatedAt, syncStatus, version';

export interface CreateInspectionInput {
  siteId: string;
  inspectorId: string;
  notes: string;
  equipmentIds: string[];
}

/**
 * Creates an inspection and its checklist items in one transaction.
 * Everything is written locally first; queue entries make the backend
 * catch up later. Client-generated ids make the sync idempotent.
 */
export async function createInspection(input: CreateInspectionInput): Promise<string> {
  const db = await getDatabase();
  const inspectionId = uuid();
  const now = nowIso();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO inspections
         (id, siteId, inspectorId, startedAt, completedAt, status, notes, latitude, longitude,
          createdAt, updatedAt, syncStatus, version)
       VALUES (?, ?, ?, ?, NULL, 'in_progress', ?, NULL, NULL, ?, ?, 'pending', 1)`,
      [inspectionId, input.siteId, input.inspectorId, now, input.notes, now, now],
    );

    const itemStmt = await db.prepareAsync(
      `INSERT INTO inspection_items
         (id, inspectionId, equipmentId, condition, physicalDamage, wiring, cleanliness,
          thermalCondition, notes, createdAt, updatedAt, syncStatus)
       VALUES (?, ?, ?, NULL, NULL, NULL, NULL, NULL, '', ?, ?, 'pending')`,
    );

    for (const equipmentId of input.equipmentIds) {
      const itemId = uuid();
      await itemStmt.executeAsync([itemId, inspectionId, equipmentId, now, now]);
      await enqueue({
        entityType: 'inspection_item',
        entityId: itemId,
        operation: 'create',
        payload: JSON.stringify({
          id: itemId,
          inspectionId,
          equipmentId,
          condition: null,
          physicalDamage: null,
          wiring: null,
          cleanliness: null,
          thermalCondition: null,
          notes: '',
          createdAt: now,
          updatedAt: now,
        }),
      });
    }
    await itemStmt.finalizeAsync();
  });

  const payload = await getPayload(inspectionId);
  if (payload) {
    await enqueue({
      entityType: 'inspection',
      entityId: inspectionId,
      operation: 'create',
      payload: JSON.stringify(payload),
    });
  }

  return inspectionId;
}

export interface InspectionDetail extends InspectionWithSite {
  itemCount: number;
  completedCount: number;
}

export async function getDetail(id: string): Promise<InspectionDetail | null> {
  const db = await getDatabase();
  const inspection = await db.getFirstAsync<InspectionDetail>(
    `SELECT ${columnList('i')}, s.name AS siteName,
       (SELECT COUNT(*) FROM inspection_items x WHERE x.inspectionId = i.id) AS itemCount,
       (SELECT COUNT(*) FROM inspection_items x WHERE x.inspectionId = i.id AND x.condition IS NOT NULL) AS completedCount
     FROM inspections i
     JOIN sites s ON s.id = i.siteId
     WHERE i.id = ?`,
    [id],
  );
  return inspection ?? null;
}

export interface InspectionListRow extends InspectionWithSite {
  itemCount: number;
  completedCount: number;
}

export interface ListInspectionsFilters {
  status?: InspectionStatus | 'all';
  search?: string;
  siteId?: string;
  limit?: number;
  offset?: number;
}

/** One query returns rows + checklist progress (no N+1 lookups). */
export async function listInspections(
  filters: ListInspectionsFilters = {},
): Promise<InspectionListRow[]> {
  const db = await getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (filters.status && filters.status !== 'all') {
    conditions.push('i.status = ?');
    params.push(filters.status);
  }
  const search = filters.search?.trim();
  if (search) {
    conditions.push("(s.name LIKE ? || '%' OR i.inspectorId LIKE ? || '%')");
    params.push(search, search);
  }
  if (filters.siteId) {
    conditions.push('i.siteId = ?');
    params.push(filters.siteId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(filters.limit ?? 50, filters.offset ?? 0);

  return db.getAllAsync<InspectionListRow>(
    `SELECT ${columnList('i')}, s.name AS siteName,
       COUNT(x.id) AS itemCount,
       SUM(CASE WHEN x.condition IS NOT NULL THEN 1 ELSE 0 END) AS completedCount
     FROM inspections i
     JOIN sites s ON s.id = i.siteId
     LEFT JOIN inspection_items x ON x.inspectionId = i.id
     ${where}
     GROUP BY i.id
     ORDER BY i.updatedAt DESC
     LIMIT ? OFFSET ?`,
    params,
  );
}

export interface CompleteInspectionInput {
  inspectionId: string;
  notes: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Marks an inspection completed (with GPS + notes) and bumps the version.
 * The version field gives the backend a lightweight optimistic-locking hint.
 */
export async function completeInspection(input: CompleteInspectionInput): Promise<Inspection | null> {
  const db = await getDatabase();
  const now = nowIso();

  await db.runAsync(
    `UPDATE inspections
     SET status = 'completed', completedAt = ?, notes = ?, latitude = ?, longitude = ?,
         version = version + 1, syncStatus = 'pending', updatedAt = ?
     WHERE id = ?`,
    [now, input.notes, input.latitude, input.longitude, now, input.inspectionId],
  );

  await enqueueEntity('inspection', input.inspectionId, 'update');
  return getById(input.inspectionId);
}

export async function updateNotes(inspectionId: string, notes: string): Promise<void> {
  const db = await getDatabase();
  const now = nowIso();
  await db.runAsync(
    `UPDATE inspections SET notes = ?, syncStatus = 'pending', updatedAt = ? WHERE id = ?`,
    [notes, now, inspectionId],
  );
  await enqueueEntity('inspection', inspectionId, 'update');
}

export async function getById(id: string): Promise<Inspection | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Inspection>(
    `SELECT ${INSPECTION_COLUMNS} FROM inspections WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function countAll(): Promise<{ total: number; completed: number }> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ total: number; completed: number }>(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
     FROM inspections`,
  );
  return { total: row?.total ?? 0, completed: row?.completed ?? 0 };
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE inspections SET syncStatus = 'synced', updatedAt = updatedAt WHERE id = ?`,
    [id],
  );
}

export async function getPayload(
  id: string,
): Promise<Omit<Inspection, 'syncStatus'> | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Omit<Inspection, 'syncStatus'>>(
    `SELECT id, siteId, inspectorId, startedAt, completedAt, status, notes, latitude, longitude,
            createdAt, updatedAt, version
     FROM inspections WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

/**
 * Re-reads the fresh entity and queues an upsert. Used whenever a local
 * mutation must be mirrored to the backend.
 */
async function enqueueEntity(
  entityType: 'inspection',
  entityId: string,
  operation: SyncOperation,
): Promise<void> {
  const payload = await getPayload(entityId);
  if (!payload) return;
  await enqueue({
    entityType,
    entityId,
    operation,
    payload: JSON.stringify(payload),
  });
}

function columnList(alias: string): string {
  return INSPECTION_COLUMNS.split(', ')
    .map((c) => `${alias}.${c}`)
    .join(', ');
}

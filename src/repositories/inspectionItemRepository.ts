import { getDatabase } from '@/database/db';
import type {
  CheckGrade,
  InspectionItem,
  InspectionItemWithEquipment,
  ItemCondition,
} from '@/types';
import { nowIso } from '@/utils/format';
import { enqueue } from './syncQueueRepository';

export interface SaveItemResultInput {
  itemId: string;
  condition: ItemCondition;
  physicalDamage: CheckGrade;
  wiring: CheckGrade;
  cleanliness: CheckGrade;
  thermalCondition: number | null;
  notes: string;
}

/**
 * Persists a checklist result locally and queues the upsert. A save never
 * touches the network, so it always succeeds offline.
 */
export async function saveResult(input: SaveItemResultInput): Promise<InspectionItem | null> {
  const db = await getDatabase();
  const now = nowIso();

  await db.runAsync(
    `UPDATE inspection_items
     SET condition = ?, physicalDamage = ?, wiring = ?, cleanliness = ?,
         thermalCondition = ?, notes = ?, syncStatus = 'pending', updatedAt = ?
     WHERE id = ?`,
    [
      input.condition,
      input.physicalDamage,
      input.wiring,
      input.cleanliness,
      input.thermalCondition,
      input.notes,
      now,
      input.itemId,
    ],
  );

  const payload = await getPayload(input.itemId);
  if (payload) {
    await enqueue({
      entityType: 'inspection_item',
      entityId: input.itemId,
      operation: 'update',
      payload: JSON.stringify(payload),
    });
  }

  return getById(input.itemId);
}

export async function getByInspection(
  inspectionId: string,
): Promise<InspectionItemWithEquipment[]> {
  const db = await getDatabase();
  return db.getAllAsync<InspectionItemWithEquipment>(
    `SELECT
       i.id, i.inspectionId, i.equipmentId, i.condition, i.physicalDamage, i.wiring,
       i.cleanliness, i.thermalCondition, i.notes, i.createdAt, i.updatedAt, i.syncStatus,
       e.name AS equipmentName, e.type AS equipmentType, e.serialNumber AS equipmentSerial
     FROM inspection_items i
     JOIN equipment e ON e.id = i.equipmentId
     WHERE i.inspectionId = ?
     ORDER BY e.name ASC`,
    [inspectionId],
  );
}

export interface ItemDetail extends InspectionItemWithEquipment {
  siteId: string;
  inspectionStatus: string;
}

export async function getDetail(itemId: string): Promise<ItemDetail | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ItemDetail>(
    `SELECT
       i.id, i.inspectionId, i.equipmentId, i.condition, i.physicalDamage, i.wiring,
       i.cleanliness, i.thermalCondition, i.notes, i.createdAt, i.updatedAt, i.syncStatus,
       e.name AS equipmentName, e.type AS equipmentType, e.serialNumber AS equipmentSerial,
       e.siteId AS siteId, ins.status AS inspectionStatus
     FROM inspection_items i
     JOIN equipment e ON e.id = i.equipmentId
     JOIN inspections ins ON ins.id = i.inspectionId
     WHERE i.id = ?`,
    [itemId],
  );
  return row ?? null;
}

export async function getById(id: string): Promise<InspectionItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InspectionItem>(
    `SELECT id, inspectionId, equipmentId, condition, physicalDamage, wiring, cleanliness,
            thermalCondition, notes, createdAt, updatedAt, syncStatus
     FROM inspection_items WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export interface InspectionProgressCounts {
  total: number;
  completed: number;
}

export async function getProgress(inspectionId: string): Promise<InspectionProgressCounts> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InspectionProgressCounts>(
    `SELECT COUNT(*) AS total,
       SUM(CASE WHEN condition IS NOT NULL THEN 1 ELSE 0 END) AS completed
     FROM inspection_items WHERE inspectionId = ?`,
    [inspectionId],
  );
  return { total: row?.total ?? 0, completed: row?.completed ?? 0 };
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE inspection_items SET syncStatus = 'synced' WHERE id = ?`,
    [id],
  );
}

export async function getPayload(
  id: string,
): Promise<Omit<InspectionItem, 'syncStatus'> | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Omit<InspectionItem, 'syncStatus'>>(
    `SELECT id, inspectionId, equipmentId, condition, physicalDamage, wiring, cleanliness,
            thermalCondition, notes, createdAt, updatedAt
     FROM inspection_items WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

/** Read-only history for the equipment profile screen (no inspection open). */
export async function getRecentForEquipment(
  equipmentId: string,
  limit = 10,
): Promise<InspectionItemWithEquipment[]> {
  const db = await getDatabase();
  return db.getAllAsync<InspectionItemWithEquipment>(
    `SELECT
       i.id, i.inspectionId, i.equipmentId, i.condition, i.physicalDamage, i.wiring,
       i.cleanliness, i.thermalCondition, i.notes, i.createdAt, i.updatedAt, i.syncStatus,
       e.name AS equipmentName, e.type AS equipmentType, e.serialNumber AS equipmentSerial
     FROM inspection_items i
     JOIN equipment e ON e.id = i.equipmentId
     WHERE i.equipmentId = ? AND i.condition IS NOT NULL
     ORDER BY i.updatedAt DESC LIMIT ?`,
    [equipmentId, limit],
  );
}

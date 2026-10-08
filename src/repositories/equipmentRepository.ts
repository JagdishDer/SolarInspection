import { getDatabase } from '@/database/db';
import type { Equipment, EquipmentStatus, EquipmentType, SyncEntityType } from '@/types';
import { nowIso } from '@/utils/format';

export interface EquipmentListFilters {
  siteId: string;
  search?: string;
  type?: EquipmentType | 'all';
  status?: EquipmentStatus | 'all';
  limit: number;
  offset: number;
}

const EQUIPMENT_COLUMNS =
  'id, siteId, name, type, serialNumber, location, status, createdAt, updatedAt, syncStatus';

/**
 * Paginated, indexed query. Search is a prefix match (LIKE 'term%') so the
 * (siteId, name) index is used even across 10k+ rows.
 */
export async function listPaged(filters: EquipmentListFilters): Promise<Equipment[]> {
  const db = await getDatabase();

  const conditions = ['siteId = ?'];
  const params: (string | number)[] = [filters.siteId];

  const search = filters.search?.trim();
  if (search) {
    conditions.push("(name LIKE ? || '%' OR serialNumber LIKE ? || '%')");
    params.push(search, search);
  }
  if (filters.type && filters.type !== 'all') {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  params.push(filters.limit, filters.offset);

  return db.getAllAsync<Equipment>(
    `SELECT ${EQUIPMENT_COLUMNS} FROM equipment
     WHERE ${conditions.join(' AND ')}
     ORDER BY name ASC
     LIMIT ? OFFSET ?`,
    params,
  );
}

export async function countMatching(filters: Omit<EquipmentListFilters, 'limit' | 'offset'>): Promise<number> {
  const db = await getDatabase();

  const conditions = ['siteId = ?'];
  const params: (string | number)[] = [filters.siteId];

  const search = filters.search?.trim();
  if (search) {
    conditions.push("(name LIKE ? || '%' OR serialNumber LIKE ? || '%')");
    params.push(search, search);
  }
  if (filters.type && filters.type !== 'all') {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.status && filters.status !== 'all') {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  const row = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) AS c FROM equipment WHERE ${conditions.join(' AND ')}`,
    params,
  );
  return row?.c ?? 0;
}

export async function getById(id: string): Promise<Equipment | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Equipment>(
    `SELECT ${EQUIPMENT_COLUMNS} FROM equipment WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function countAll(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM equipment');
  return row?.c ?? 0;
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE equipment SET syncStatus = ?, updatedAt = ? WHERE id = ?', [
    'synced',
    nowIso(),
    id,
  ]);
}

export function entityType(): SyncEntityType {
  return 'equipment';
}

/** Fresh payload for queue entries (entity minus local bookkeeping). */
export async function getPayload(id: string): Promise<Omit<Equipment, 'syncStatus'> | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<Omit<Equipment, 'syncStatus'>>(
    `SELECT id, siteId, name, type, serialNumber, location, status, createdAt, updatedAt
     FROM equipment WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

import { getDatabase } from '@/database/db';
import type { SiteWithStats } from '@/types';
import { nowIso } from '@/utils/format';

export { SiteWithStats };

const SITE_COLUMNS = 'id, name, location, capacityMw, createdAt, updatedAt, syncStatus';

export async function getAllWithStats(): Promise<SiteWithStats[]> {
  const db = await getDatabase();
  return db.getAllAsync<SiteWithStats>(
    `SELECT ${SITE_COLUMNS},
       (SELECT COUNT(*) FROM equipment e WHERE e.siteId = sites.id) AS equipmentCount
     FROM sites ORDER BY name ASC`,
  );
}

export async function getByIdWithStats(id: string): Promise<SiteWithStats | null> {
  const db = await getDatabase();
  const site = await db.getFirstAsync<SiteWithStats>(
    `SELECT ${SITE_COLUMNS},
       (SELECT COUNT(*) FROM equipment e WHERE e.siteId = sites.id) AS equipmentCount
     FROM sites WHERE id = ?`,
    [id],
  );
  return site ?? null;
}

export async function countSites(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ c: number }>('SELECT COUNT(*) AS c FROM sites');
  return row?.c ?? 0;
}

export async function markSynced(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE sites SET syncStatus = ?, updatedAt = ? WHERE id = ?', [
    'synced',
    nowIso(),
    id,
  ]);
}

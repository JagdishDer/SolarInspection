import type { SQLiteDatabase } from 'expo-sqlite';

export interface Migration {
  version: number;
  description: string;
  statements: string[];
}

/**
 * Versioned, append-only migrations. Each migration runs once inside a
 * transaction and is recorded in `schema_migrations`.
 */
export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: 'Initial schema: sites, equipment, inspections, inspection_items, photos, sync_queue',
    statements: [
      `CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        location TEXT NOT NULL,
        capacityMw REAL NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'synced'
      )`,

      `CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY NOT NULL,
        siteId TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        serialNumber TEXT NOT NULL,
        location TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'operational',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'synced'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_equipment_site_name ON equipment(siteId, name)`,
      `CREATE INDEX IF NOT EXISTS idx_equipment_site_type ON equipment(siteId, type)`,
      `CREATE INDEX IF NOT EXISTS idx_equipment_site_status ON equipment(siteId, status)`,

      `CREATE TABLE IF NOT EXISTS inspections (
        id TEXT PRIMARY KEY NOT NULL,
        siteId TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
        inspectorId TEXT NOT NULL,
        startedAt TEXT NOT NULL,
        completedAt TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        notes TEXT NOT NULL DEFAULT '',
        latitude REAL,
        longitude REAL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending',
        version INTEGER NOT NULL DEFAULT 1
      )`,
      `CREATE INDEX IF NOT EXISTS idx_inspections_site ON inspections(siteId)`,
      `CREATE INDEX IF NOT EXISTS idx_inspections_status ON inspections(status)`,
      `CREATE INDEX IF NOT EXISTS idx_inspections_updated ON inspections(updatedAt DESC)`,

      `CREATE TABLE IF NOT EXISTS inspection_items (
        id TEXT PRIMARY KEY NOT NULL,
        inspectionId TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
        equipmentId TEXT NOT NULL REFERENCES equipment(id),
        condition TEXT,
        physicalDamage TEXT,
        wiring TEXT,
        cleanliness TEXT,
        thermalCondition REAL,
        notes TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        syncStatus TEXT NOT NULL DEFAULT 'pending'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_items_inspection ON inspection_items(inspectionId)`,
      `CREATE INDEX IF NOT EXISTS idx_items_equipment ON inspection_items(equipmentId)`,

      `CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY NOT NULL,
        inspectionId TEXT NOT NULL REFERENCES inspections(id) ON DELETE CASCADE,
        inspectionItemId TEXT,
        localUri TEXT NOT NULL,
        remoteUrl TEXT,
        latitude REAL,
        longitude REAL,
        createdAt TEXT NOT NULL,
        uploadStatus TEXT NOT NULL DEFAULT 'pending'
      )`,
      `CREATE INDEX IF NOT EXISTS idx_photos_inspection ON photos(inspectionId)`,
      `CREATE INDEX IF NOT EXISTS idx_photos_item ON photos(inspectionItemId)`,

      `CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY NOT NULL,
        entityType TEXT NOT NULL,
        entityId TEXT NOT NULL,
        operation TEXT NOT NULL,
        payload TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        lastError TEXT,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_queue_status ON sync_queue(status, createdAt)`,
      `CREATE INDEX IF NOT EXISTS idx_queue_entity ON sync_queue(entityType, entityId)`,
    ],
  },
];

interface MigrationRow {
  version: number;
}

/**
 * Applies all pending migrations. Safe to call on every launch: applied
 * versions are recorded in `schema_migrations` and skipped afterwards.
 */
export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY NOT NULL,
      description TEXT NOT NULL,
      appliedAt TEXT NOT NULL
    )`,
  );

  const appliedRows = await db.getAllAsync<MigrationRow>(
    'SELECT version FROM schema_migrations',
  );
  const appliedVersions = new Set(appliedRows.map((r) => r.version));

  for (const migration of MIGRATIONS) {
    if (appliedVersions.has(migration.version)) continue;

    await db.withTransactionAsync(async () => {
      for (const statement of migration.statements) {
        await db.execAsync(statement);
      }
      await db.runAsync(
        'INSERT INTO schema_migrations (version, description, appliedAt) VALUES (?, ?, ?)',
        [migration.version, migration.description, new Date().toISOString()],
      );
      await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    });
  }
}

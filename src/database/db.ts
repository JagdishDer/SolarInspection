import * as SQLite from 'expo-sqlite';

import { migrateDatabase } from './migrations';
import { seedDatabaseIfEmpty } from './seed';

const DATABASE_NAME = 'solar-inspect.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

/**
 * Opens (once) and returns the app database. Runs migrations and first-launch
 * seeding before the promise resolves, so callers always see a ready schema.
 */
export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = openAndPrepareDatabase().catch((error) => {
      // Allow a later retry if preparation failed (e.g. transient IO error).
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function openAndPrepareDatabase(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DATABASE_NAME);

  await db.execAsync('PRAGMA journal_mode = WAL');
  await db.execAsync('PRAGMA foreign_keys = ON');

  await migrateDatabase(db);
  await seedDatabaseIfEmpty(db);

  return db;
}

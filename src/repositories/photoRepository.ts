import { getDatabase } from '@/database/db';
import type { InspectionPhoto } from '@/types';
import { uuid } from '@/utils/uuid';
import { nowIso } from '@/utils/format';
import { enqueue } from './syncQueueRepository';

export interface CreatePhotoInput {
  inspectionId: string;
  inspectionItemId: string | null;
  localUri: string;
  latitude: number | null;
  longitude: number | null;
}

/**
 * Stores photo metadata locally (the file itself lives in the app documents
 * directory) and queues the upload. Metadata + queueing happen offline.
 */
export async function create(input: CreatePhotoInput): Promise<InspectionPhoto> {
  const db = await getDatabase();
  const id = uuid();
  const now = nowIso();

  await db.runAsync(
    `INSERT INTO photos
       (id, inspectionId, inspectionItemId, localUri, remoteUrl, latitude, longitude, createdAt, uploadStatus)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?, 'pending')`,
    [id, input.inspectionId, input.inspectionItemId, input.localUri, input.latitude, input.longitude, now],
  );

  const photo = await getById(id);
  if (photo) {
    await enqueue({
      entityType: 'photo',
      entityId: id,
      operation: 'create',
      payload: JSON.stringify({
        id: photo.id,
        inspectionId: photo.inspectionId,
        inspectionItemId: photo.inspectionItemId,
        localUri: photo.localUri,
        remoteUrl: null,
        latitude: photo.latitude,
        longitude: photo.longitude,
        createdAt: photo.createdAt,
      }),
    });
  }

  return photo as InspectionPhoto;
}

export async function getById(id: string): Promise<InspectionPhoto | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InspectionPhoto>(
    `SELECT id, inspectionId, inspectionItemId, localUri, remoteUrl, latitude, longitude,
            createdAt, uploadStatus
     FROM photos WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function getByInspection(inspectionId: string): Promise<InspectionPhoto[]> {
  const db = await getDatabase();
  return db.getAllAsync<InspectionPhoto>(
    `SELECT id, inspectionId, inspectionItemId, localUri, remoteUrl, latitude, longitude,
            createdAt, uploadStatus
     FROM photos WHERE inspectionId = ?
     ORDER BY createdAt DESC`,
    [inspectionId],
  );
}

export async function getByItem(inspectionItemId: string): Promise<InspectionPhoto[]> {
  const db = await getDatabase();
  return db.getAllAsync<InspectionPhoto>(
    `SELECT id, inspectionId, inspectionItemId, localUri, remoteUrl, latitude, longitude,
            createdAt, uploadStatus
     FROM photos WHERE inspectionItemId = ?
     ORDER BY createdAt DESC`,
    [inspectionItemId],
  );
}

export async function markUploaded(id: string, remoteUrl: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE photos SET uploadStatus = 'uploaded', remoteUrl = ? WHERE id = ?`,
    [remoteUrl, id],
  );
}

export async function markUploadFailed(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`UPDATE photos SET uploadStatus = 'failed' WHERE id = ?`, [id]);
}

/** Removes the metadata row; the caller is responsible for the file itself. */
export async function remove(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM photos WHERE id = ?', [id]);
}

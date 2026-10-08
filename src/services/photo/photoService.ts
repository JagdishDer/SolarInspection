import { Directory, File, Paths } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { PHOTO_COMPRESS_QUALITY, PHOTO_MAX_WIDTH } from '@/constants/domain';
import * as photoRepository from '@/repositories/photoRepository';
import type { Coordinates } from '@/services/location/locationService';
import type { InspectionPhoto } from '@/types';
import { uuid } from '@/utils/uuid';

export class PhotoStoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoStoreError';
  }
}

const PHOTO_DIR_NAME = 'inspection-photos';

function photoDirectory(): Directory {
  return new Directory(Paths.document, PHOTO_DIR_NAME);
}

/**
 * Persists a captured photo for offline use:
 * 1. Resize + compress with ImageManipulator (works fully offline).
 * 2. Move the file out of the cache into the app documents directory.
 * 3. Store metadata in SQLite and queue the upload.
 *
 * Throws PhotoStoreError for file failures; callers surface them without
 * blocking the inspection.
 */
export async function persistCapturedPhoto(input: {
  capturedUri: string;
  inspectionId: string;
  inspectionItemId: string | null;
  coordinates: Coordinates | null;
}): Promise<InspectionPhoto> {
  let manipulated: ImageManipulator.ImageResult;
  try {
    manipulated = await ImageManipulator.manipulateAsync(
      input.capturedUri,
      [{ resize: { width: PHOTO_MAX_WIDTH } }],
      {
        compress: PHOTO_COMPRESS_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      },
    );
  } catch (error) {
    throw new PhotoStoreError(
      `Could not process photo: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }

  try {
    const directory = photoDirectory();
    if (!directory.exists) {
      directory.create({ intermediates: true, idempotent: true });
    }
    const destination = new File(directory, `${uuid()}.jpg`);
    const source = new File(manipulated.uri);
    source.move(destination);

    return await photoRepository.create({
      inspectionId: input.inspectionId,
      inspectionItemId: input.inspectionItemId,
      localUri: destination.uri,
      latitude: input.coordinates?.latitude ?? null,
      longitude: input.coordinates?.longitude ?? null,
    });
  } catch (error) {
    throw new PhotoStoreError(
      `Could not store photo: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
}

/** Deletes the local file (best effort) and the metadata row. */
export async function deletePhoto(photo: InspectionPhoto): Promise<void> {
  try {
    const file = new File(photo.localUri);
    if (file.exists) file.delete();
  } catch {
    // File may already be gone; metadata cleanup still proceeds.
  }
  await photoRepository.remove(photo.id);
}

import { getDatabase } from '@/database/db';
import { initConnectivity, refreshNetworkStatus } from '@/services/connectivity';
import { syncService } from '@/services/sync/syncService';
import * as syncQueueRepository from '@/repositories/syncQueueRepository';
import { useSyncStore } from '@/stores/syncStore';

let bootPromise: Promise<void> | null = null;

/**
 * One-time app bootstrap: open + migrate + seed the database, recover any
 * queue entries interrupted by an app kill, then sync if already online.
 * Safe to call repeatedly; every call awaits the same promise.
 */
export function bootstrapApp(): Promise<void> {
  if (!bootPromise) {
    bootPromise = runBootstrap().catch((error) => {
      bootPromise = null;
      throw error;
    });
  }
  return bootPromise;
}

async function runBootstrap(): Promise<void> {
  // 1) Database: migrations + first-launch seed.
  await getDatabase();

  // 2) Queue entries caught mid-flight by an app restart become pending.
  await syncQueueRepository.recoverInterrupted();

  // 3) Connectivity status + listener, then a first sync if online.
  initConnectivity();
  const online = await refreshNetworkStatus();
  if (online) {
    await useSyncStore.getState().refreshCounts();
    void syncService.syncNow('app-start').catch(() => {
      // Failures are reflected in the sync store; never crash the app.
    });
  } else {
    await useSyncStore.getState().refreshCounts();
  }
}

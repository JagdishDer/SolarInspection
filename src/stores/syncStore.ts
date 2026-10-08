import { create } from 'zustand';

import * as syncQueueRepository from '@/repositories/syncQueueRepository';
import type { NetworkStatus, SyncUiState } from '@/types/sync';

interface SyncStoreState {
  networkStatus: NetworkStatus | 'unknown';
  syncState: SyncUiState;
  pendingCount: number;
  failedCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;

  setNetworkStatus: (status: NetworkStatus | 'unknown') => void;
  setSyncState: (state: SyncUiState) => void;
  setSyncError: (error: string | null) => void;
  setLastSyncedAt: (iso: string) => void;
  setCounts: (counts: { pending: number; failed: number }) => void;
  /** Re-reads queue counts from SQLite (single cheap aggregate query). */
  refreshCounts: () => Promise<void>;
}

/**
 * Sync/network state hub shared by the SyncService and every screen that
 * displays connectivity or queue status. Business data itself lives in
 * SQLite; this store only mirrors derived status for the UI.
 */
export const useSyncStore = create<SyncStoreState>()((set) => ({
  networkStatus: 'unknown',
  syncState: 'idle',
  pendingCount: 0,
  failedCount: 0,
  lastSyncedAt: null,
  lastError: null,

  setNetworkStatus: (networkStatus) => set({ networkStatus }),
  setSyncState: (syncState) => set({ syncState }),
  setSyncError: (lastError) => set({ lastError }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),
  setCounts: (counts) => set({ pendingCount: counts.pending, failedCount: counts.failed }),
  refreshCounts: async () => {
    const counts = await syncQueueRepository.getCounts();
    set({ pendingCount: counts.pending, failedCount: counts.failed });
  },
}));

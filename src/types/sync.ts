import type { SyncEntityType } from './index';

export type NetworkStatus = 'online' | 'offline';

/**
 * High-level sync state surfaced to the UI:
 * online / offline / syncing / sync complete / sync error.
 */
export type SyncUiState = 'idle' | 'syncing' | 'done' | 'error';

export interface SyncResult {
  processed: number;
  succeeded: number;
  failed: number;
  remaining: number;
  /** True when sync was skipped because another run is already active. */
  skipped?: boolean;
  stoppedReason?: 'offline' | 'complete' | 'error';
}

export interface SyncCounts {
  pending: number;
  failed: number;
}

export type SyncTrigger = 'manual' | 'connectivity-restored' | 'app-start';

/** Maps a queued entity type to its API upsert handler. */
export type SyncEntityHandlers = Record<SyncEntityType, never>;

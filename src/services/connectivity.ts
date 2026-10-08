import * as Network from 'expo-network';

import { syncService } from './sync/syncService';
import { useSyncStore } from '@/stores/syncStore';

let initialized = false;

function isOnline(state: Network.NetworkState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/** Reads the current network state once and mirrors it into the sync store. */
export async function refreshNetworkStatus(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    const online = isOnline(state);
    useSyncStore.getState().setNetworkStatus(online ? 'online' : 'offline');
    return online;
  } catch {
    // Never treat a network-module failure as a fatal error.
    useSyncStore.getState().setNetworkStatus('unknown');
    return false;
  }
}

/**
 * Subscribes to connectivity changes for the app lifetime. When the device
 * comes back online, synchronization starts automatically.
 */
export function initConnectivity(): void {
  if (initialized) return;
  initialized = true;

  Network.addNetworkStateListener((state) => {
    const online = isOnline(state);
    const previous = useSyncStore.getState().networkStatus;
    useSyncStore.getState().setNetworkStatus(online ? 'online' : 'offline');

    const restored = online && previous !== 'online';
    if (restored) {
      void syncService.syncNow('connectivity-restored').catch(() => {
        // Sync failures are already reflected in the sync store.
      });
    }
  });
}

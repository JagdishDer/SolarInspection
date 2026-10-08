import { create } from 'zustand';

interface UiStoreState {
  /** Remembered between inspection creations within the session. */
  inspectorName: string;
  /**
   * Incremented by the camera screen after a photo is persisted so the
   * screen that opened the camera knows to re-read photos from SQLite.
   */
  photoCaptureCount: number;

  setInspectorName: (name: string) => void;
  bumpPhotoCaptureCount: () => void;
}

/**
 * Transient UI-only state. List filters/search live in component state
 * (they are per-screen concerns); this store only holds values that must
 * survive navigation between screens in a flow.
 */
export const useUiStore = create<UiStoreState>()((set) => ({
  inspectorName: '',
  photoCaptureCount: 0,
  setInspectorName: (inspectorName) => set({ inspectorName }),
  bumpPhotoCaptureCount: () =>
    set((state) => ({ photoCaptureCount: state.photoCaptureCount + 1 })),
}));

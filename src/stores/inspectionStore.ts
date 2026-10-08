import { create } from 'zustand';

interface InspectionStoreState {
  creating: boolean;
  error: string | null;
  /** Equipment selected for a new inspection (create flow). */
  selectedEquipmentIds: string[];

  toggleSelectedEquipment: (equipmentId: string) => void;
  setSelectedEquipment: (equipmentIds: string[]) => void;
  clearSelection: () => void;
  setCreating: (creating: boolean) => void;
  setError: (error: string | null) => void;
}

/**
 * Session state for the create-inspection flow. The durable records
 * (inspections, checklist items) live in SQLite; this store only carries
 * the multi-select selection across the create screen.
 */
export const useInspectionStore = create<InspectionStoreState>()((set) => ({
  creating: false,
  error: null,
  selectedEquipmentIds: [],

  toggleSelectedEquipment: (equipmentId) =>
    set((state) => {
      const selectedEquipmentIds = state.selectedEquipmentIds.includes(equipmentId)
        ? state.selectedEquipmentIds.filter((id) => id !== equipmentId)
        : [...state.selectedEquipmentIds, equipmentId];
      return { selectedEquipmentIds };
    }),
  setSelectedEquipment: (selectedEquipmentIds) => set({ selectedEquipmentIds }),
  clearSelection: () => set({ selectedEquipmentIds: [] }),
  setCreating: (creating) => set({ creating }),
  setError: (error) => set({ error }),
}));

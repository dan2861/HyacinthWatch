import { create } from 'zustand';

const defaultFilters = {
  dateFrom: null,
  dateTo: null,
  status: 'all',
  minQuality: null,
  minConfidence: null,
  hasMask: null,
  modelVersion: null,
};

export const useFilterStore = create((set) => ({
  filters: defaultFilters,
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),
  resetFilters: () => set({ filters: defaultFilters }),
}));


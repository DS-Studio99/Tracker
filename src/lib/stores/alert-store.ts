import { create } from 'zustand'

interface AlertState {
  unreadAlertCount: number;
  setUnreadAlertCount: (count: number) => void;
  incrementAlertCount: () => void;
  resetAlertCount: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  unreadAlertCount: 0,
  setUnreadAlertCount: (count) => set({ unreadAlertCount: count }),
  incrementAlertCount: () => set((state) => ({ unreadAlertCount: state.unreadAlertCount + 1 })),
  resetAlertCount: () => set({ unreadAlertCount: 0 }),
}))

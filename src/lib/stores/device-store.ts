import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Device } from '../types/database'
import { createClient } from '../supabase/client'

interface DeviceState {
  selectedDeviceId: string | null;
  devices: Device[];
  setSelectedDevice: (id: string) => void;
  setDevices: (devices: Device[]) => void;
  getSelectedDevice: () => Device | undefined;
  removeDevice: (id: string) => void;
  updateDevice: (id: string, updates: Partial<Device>) => void;
  fetchDevices: () => Promise<void>;
}

export const useDeviceStore = create<DeviceState>()(
  persist(
    (set, get) => ({
      selectedDeviceId: null,
      devices: [],
      setSelectedDevice: (id) => set({ selectedDeviceId: id }),
      setDevices: (devices) => set({ devices }),
      getSelectedDevice: () => {
        const state = get()
        return state.devices.find((d) => d.id === state.selectedDeviceId)
      },
      removeDevice: (id) => set((state) => ({
        devices: state.devices.filter((d) => d.id !== id),
        selectedDeviceId: state.selectedDeviceId === id ? null : state.selectedDeviceId,
      })),
      updateDevice: (id, updates) => set((state) => ({
        devices: state.devices.map((d) => d.id === id ? { ...d, ...updates } : d),
      })),
      fetchDevices: async () => {
        try {
          const supabase = createClient()
          const { data: { user } } = await supabase.auth.getUser()
          if (!user) return

          const { data, error } = await supabase
            .from('devices')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })

          if (!error && data) {
            const deviceList = data as Device[]
            const state = get()
            set({ devices: deviceList })
            // Auto-select first device if none selected
            if (deviceList.length > 0 && !state.selectedDeviceId) {
              set({ selectedDeviceId: deviceList[0].id })
            }
          }
        } catch (e) {
          console.error('Failed to fetch devices', e)
        }
      },
    }),
    {
      name: 'device-storage',
      partialize: (state) => ({ selectedDeviceId: state.selectedDeviceId }),
    }
  )
)

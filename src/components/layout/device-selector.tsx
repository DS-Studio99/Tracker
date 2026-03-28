"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore } from "@/lib/stores/device-store";
import { Device } from "@/lib/types/database";
import { formatTime } from "@/lib/utils/format";
import * as Icons from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export function DeviceSelector() {
  const supabase = createClient();
  const { devices, setDevices, selectedDeviceId, setSelectedDevice } = useDeviceStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDevices() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('devices')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        const deviceList = data as Device[];
        setDevices(deviceList);
        if (deviceList.length > 0 && !selectedDeviceId) {
          setSelectedDevice(deviceList[0].id);
        }
      }
      setLoading(false);
    }

    fetchDevices();
  }, [setDevices, selectedDeviceId, setSelectedDevice, supabase]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 bg-slate-100 dark:bg-slate-800 rounded-md animate-pulse">
        <div className="w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700" />
        <div className="w-32 h-4 bg-slate-300 dark:bg-slate-700 rounded" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex items-center gap-2 h-10 px-3 text-sm text-slate-500 bg-slate-50 dark:bg-slate-900 rounded-md border border-dashed border-slate-300 dark:border-slate-800">
        <Icons.Smartphone className="h-4 w-4" />
        <span className="hidden sm:inline">No devices connected</span>
      </div>
    );
  }

  const selectedDevice = devices.find((d) => d.id === selectedDeviceId) || devices[0];

  return (
    <Select value={selectedDeviceId || undefined} onValueChange={(val) => val && setSelectedDevice(val)}>
      <SelectTrigger className="w-[200px] sm:w-[260px] h-10 bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-emerald-500">
        <SelectValue>
          {selectedDevice && (
            <div className="flex items-center gap-2 text-left w-full overflow-hidden">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${selectedDevice.is_online ? 'bg-emerald-500' : 'bg-rose-500'}`} />
              <div className="flex flex-col overflow-hidden">
                <span className="font-medium text-sm truncate">{selectedDevice.device_name}</span>
                <span className="text-[10px] text-slate-500 truncate flex items-center gap-1">
                  <Icons.Battery className="h-3 w-3" /> {selectedDevice.battery_level}% 
                  {selectedDevice.is_online ? ' • Online' : ` • ${selectedDevice.last_seen ? formatTime(selectedDevice.last_seen) : 'Offline'}`}
                </span>
              </div>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="w-[260px] max-h-[300px]">
        {devices.map((device) => (
          <SelectItem key={device.id} value={device.id} className="py-2 focus:bg-slate-100 dark:focus:bg-slate-900">
            <div className="flex items-center justify-between w-full gap-2">
              <div className="flex flex-col text-left overflow-hidden">
                <span className="font-medium truncate pr-2">{device.device_name}</span>
                <span className="text-xs text-slate-500 truncate">{device.device_model || 'Unknown Model'}</span>
              </div>
              <Badge variant={device.is_online ? "default" : "secondary"} className={`text-[10px] ml-auto flex-shrink-0 ${device.is_online ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20' : ''}`}>
                {device.is_online ? 'Online' : 'Offline'}
              </Badge>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

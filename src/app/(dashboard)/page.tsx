"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useDeviceStore } from "@/lib/stores/device-store";
import { useSupabaseRealtime } from "@/lib/hooks/use-supabase-realtime";
import { formatRelative, formatFileSize } from "@/lib/utils/format";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { CardSkeleton, MapSkeleton } from "@/components/shared/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  Smartphone, MessageSquare, PhoneCall, MapPin, Image as ImageIcon,
  Grid, Bell, Battery, BatteryCharging, ChevronRight, Activity 
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer 
} from "recharts";

// Dynamically import Leaflet map (disables SSR to prevent window is not defined errors)
const MiniMap = dynamic(() => import("@/components/maps/mini-map"), { 
  ssr: false, 
  loading: () => <MapSkeleton /> 
});

export default function DashboardOverview() {
  const router = useRouter();
  const supabase = createClient();
  const { selectedDeviceId, devices, setDevices } = useDeviceStore();
  const [deviceStats, setDeviceStats] = useState<any>(null);

  // Live update the device in the global store when realtime changes occur
  useSupabaseRealtime(
    "devices",
    selectedDeviceId ? { column: "id", value: selectedDeviceId } : undefined,
    undefined,
    (payload) => {
      setDevices(devices.map(d => d.id === payload.new.id ? { ...d, ...payload.new } : d));
    }
  );

  // Fetch complete overview statistics
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ["device_stats", selectedDeviceId],
    queryFn: async () => {
      if (!selectedDeviceId) return null;
      const { data, error } = await (supabase.rpc as any)("get_device_stats", { p_device_id: selectedDeviceId });
      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!selectedDeviceId,
    refetchInterval: 30000, // refresh every 30s
  });

  // Fetch Recent Activity (SMS, Calls, Alerts combined logic or separate queries)
  const { data: recentSms } = useQuery({
    queryKey: ["recent_sms", selectedDeviceId],
    queryFn: async () => {
      if (!selectedDeviceId) return [];
      const { data } = await supabase.from('sms_messages').select('*').eq('device_id', selectedDeviceId).order('timestamp', { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!selectedDeviceId,
  });

  const { data: recentCalls } = useQuery({
    queryKey: ["recent_calls", selectedDeviceId],
    queryFn: async () => {
      if (!selectedDeviceId) return [];
      const { data } = await supabase.from('call_logs').select('*').eq('device_id', selectedDeviceId).order('timestamp', { ascending: false }).limit(5);
      return data || [];
    },
    enabled: !!selectedDeviceId,
  });

  const { data: topContacts } = useQuery({
    queryKey: ["top_contacts", selectedDeviceId],
    queryFn: async () => {
      if (!selectedDeviceId) return [];
      const { data } = await (supabase.rpc as any)("get_top_contacts", { p_device_id: selectedDeviceId, p_limit: 5 });
      return data || [];
    },
    enabled: !!selectedDeviceId,
  });

  const { data: recentPhotos } = useQuery({
    queryKey: ["recent_photos", selectedDeviceId],
    queryFn: async () => {
      if (!selectedDeviceId) return [];
      const { data } = await supabase.from('media_files').select('thumbnail_url, file_url, id').eq('device_id', selectedDeviceId).eq('file_type', 'photo').order('created_at', { ascending: false }).limit(6);
      return data || [];
    },
    enabled: !!selectedDeviceId,
  });

  if (!selectedDeviceId) {
    return (
      <EmptyState
        icon={<Smartphone className="h-12 w-12 text-slate-400" />}
        title="No Device Selected"
        description="Please select a device from the top right dropdown or add a new pair a new device to view the dashboard."
        action={<Button onClick={() => router.push("/devices")}>View Devices</Button>}
      />
    );
  }

  const device = devices.find(d => d.id === selectedDeviceId);
  if (!device) return <CardSkeleton />;

  const storagePercent = device.storage_total ? Math.round(((device.storage_used || 0) / device.storage_total) * 100) : 0;
  const ramPercent = device.ram_total ? Math.round(((device.ram_used || 0) / device.ram_total) * 100) : 0;
  const lastLocation = stats?.last_location;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <PageHeader 
        title="Dashboard Overview" 
        description={`Real-time insights for ${device.device_name}`}
        actions={
          <Button variant="outline" onClick={() => router.push('/settings')}>
            Device Settings
          </Button>
        }
      />

      {/* 1. DEVICE INFO BAR */}
      <Card className="bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="flex items-center gap-4 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-4 md:pb-0">
            <div className="h-12 w-12 shrink-0 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
              <Smartphone className="h-6 w-6 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="font-semibold text-lg truncate">{device.device_name}</span>
              <span className="text-sm text-slate-500 flex items-center gap-2 truncate">
                {device.device_model} • Android {device.android_version}
              </span>
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 pb-4 md:pb-0 md:px-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {device.is_online ? 'Online Now' : 'Offline'}
              </span>
              <span className="text-slate-400 text-xs text-right">
                {device.last_seen ? formatRelative(device.last_seen) : 'Never seen'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-slate-500 flex items-center gap-1.5">
                {device.is_charging ? <BatteryCharging className="h-4 w-4 text-emerald-500" /> : <Battery className="h-4 w-4 text-slate-500" />}
                {device.battery_level}% Battery
              </span>
              <Progress value={device.battery_level} className="w-24 h-2" />
            </div>
          </div>

          <div className="flex flex-col justify-center gap-3 md:px-4">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>Storage ({storagePercent}%)</span>
                <span>{formatFileSize(device.storage_used || 0)} / {formatFileSize(device.storage_total || 0)}</span>
              </div>
              <Progress value={storagePercent} className="h-1.5" />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-slate-500">
                <span>RAM ({ramPercent}%)</span>
                <span>{formatFileSize(device.ram_used || 0)} / {formatFileSize(device.ram_total || 0)}</span>
              </div>
              <Progress value={ramPercent} className="h-1.5" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. SUMMARY STAT CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {isStatsLoading ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Total SMS" value={stats?.total_sms || 0} icon={<MessageSquare className="h-5 w-5" />} onClick={() => router.push('/sms')} color="bg-blue-500/10 text-blue-500" />
            <StatCard title="Total Calls" value={stats?.total_calls || 0} icon={<PhoneCall className="h-5 w-5" />} onClick={() => router.push('/calls')} color="bg-emerald-500/10 text-emerald-500" />
            <StatCard title="Locations" value={stats?.total_locations || 0} icon={<MapPin className="h-5 w-5" />} onClick={() => router.push('/locations')} color="bg-rose-500/10 text-rose-500" />
            <StatCard title="Photos" value={stats?.total_photos || 0} icon={<ImageIcon className="h-5 w-5" />} onClick={() => router.push('/media')} color="bg-purple-500/10 text-purple-500" />
            <StatCard title="Installed Apps" value={stats?.total_apps || 0} icon={<Grid className="h-5 w-5" />} onClick={() => router.push('/apps')} color="bg-amber-500/10 text-amber-500" />
            <StatCard title="Unread Alerts" value={stats?.total_alerts_unread || 0} icon={<Bell className="h-5 w-5" />} onClick={() => router.push('/alerts')} color={stats?.total_alerts_unread > 0 ? "bg-red-500/20 text-red-600" : "bg-slate-500/10 text-slate-500"} />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 3. MINI MAP (Left Column 60%) */}
        <Card className="lg:col-span-7 flex flex-col overflow-hidden shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between py-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-rose-500" />
              Latest Location
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => router.push('/locations')}>
              View Full Map <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1">
            <MiniMap 
              lat={lastLocation?.latitude} 
              lng={lastLocation?.longitude} 
              address={lastLocation?.address} 
              timestamp={lastLocation?.timestamp} 
            />
          </CardContent>
        </Card>

        {/* 4. RECENT ACTIVITY (Right Column 40%) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between py-4 pb-2 border-b">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-emerald-500" /> Activity Feed
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100 dark:divide-slate-800">
              
              {/* SMS List */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Messages</span>
                  <Link href="/sms" className="text-xs text-blue-500 hover:underline">View all</Link>
                </div>
                {recentSms?.length === 0 ? <p className="text-xs text-slate-400">No recent messages.</p> : recentSms?.map((sms: any) => (
                  <div key={sms.id} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 ${sms.message_type === 'incoming' ? 'text-emerald-500' : 'text-blue-500'}`}>
                      <MessageSquare className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium truncate">{sms.sender_name || sms.sender_number || sms.receiver_number}</span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatRelative(sms.timestamp)}</span>
                      </div>
                      <span className="text-xs text-slate-500 truncate">{sms.body}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Calls List */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Recent Calls</span>
                  <Link href="/calls" className="text-xs text-blue-500 hover:underline">View all</Link>
                </div>
                {recentCalls?.length === 0 ? <p className="text-xs text-slate-400">No recent calls.</p> : recentCalls?.map((call: any) => (
                  <div key={call.id} className="flex items-center gap-3">
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center bg-slate-100 dark:bg-slate-900 ${
                      call.call_type === 'missed' ? 'text-red-500' : call.call_type === 'incoming' ? 'text-emerald-500' : 'text-blue-500'
                    }`}>
                      <PhoneCall className="h-4 w-4" />
                    </div>
                    <div className="flex flex-col flex-1 min-w-0">
                      <div className="flex justify-between items-center w-full">
                        <span className="text-sm font-medium truncate">{call.contact_name || call.phone_number}</span>
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">{formatRelative(call.timestamp)}</span>
                      </div>
                      <span className="text-xs text-slate-500 capitalize">{call.call_type} • {call.duration}s</span>
                    </div>
                  </div>
                ))}
              </div>

            </CardContent>
          </Card>

        </div>
      </div>

      {/* 5. CHARTS & BOTTOM ROW */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Top Contacted Numbers</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            {topContacts && topContacts.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topContacts} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                  <XAxis type="number" />
                  <YAxis dataKey="phone_number" type="category" width={100} tick={{fontSize: 12}} />
                  <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="total_interactions" name="Interactions" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">Not enough data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Camera Photos</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => router.push('/media')} className="h-8">View Gallery</Button>
          </CardHeader>
          <CardContent>
            {recentPhotos && recentPhotos.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {recentPhotos.map((photo: any) => (
                  <div key={photo.id} className="aspect-square relative rounded-md overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900 group cursor-pointer hover:shadow-md transition-all">
                    {/* Fallback to simple img if no next/image domain config, but we use an img tag for remote arbitrary URLs */}
                    <img src={photo.thumbnail_url || photo.file_url} alt="Device photo preview" className="object-cover w-full h-full transform group-hover:scale-110 transition-transform duration-300" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] w-full flex flex-col items-center justify-center text-sm text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-md border border-dashed">
                <ImageIcon className="h-8 w-8 mb-2 opacity-50" />
                No photos found
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}

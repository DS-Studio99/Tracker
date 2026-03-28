"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { format, formatDistanceToNow, parseISO } from "date-fns"
import { toast } from "sonner"
import { 
  Smartphone, Battery, BatteryCharging, HardDrive, Filter, 
  Wifi, WifiOff, Trash2, Edit2, Check, X, ShieldAlert,
  Info, BarChart3, Settings, Cpu, HardDriveDownload, MonitorSmartphone,
  Copy, SmartphoneNfc, LayoutDashboard, CopyCheck, AlertCircle, RefreshCw
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { Device } from "@/lib/types/database"
import { cn } from "@/lib/utils"

export default function DevicesPage() {
  const router = useRouter()
  const { devices, selectedDeviceId, setSelectedDevice, removeDevice, updateDevice } = useDeviceStore()
  
  const [userId, setUserId] = useState<string>("")
  const [userEmail, setUserEmail] = useState<string>("")
  const [isLoading, setIsLoading] = useState(true)

  const [filterTabs, setFilterTabs] = useState("all")
  
  // Renaming State
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")
  
  // Modals
  const [deleteDevice, setDeleteDevice] = useState<Device | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  const [infoDevice, setInfoDevice] = useState<Device | null>(null)
  const [deviceStats, setDeviceStats] = useState<any>(null)
  const [isFetchingStats, setIsFetchingStats] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    const initUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email || "your-email@example.com")
      }
      setIsLoading(false)
    }
    initUser()
  }, [])

  // Real-time listener for Auto-connect specifically targeted to current user devices
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel(`public:devices:user_${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "devices", filter: `user_id=eq.${userId}` }, (payload) => {
        const newDev = payload.new as Device
        toast.success(`🎉 New device connected: ${newDev.device_name || 'Unknown Device'}!`)
        // The zustand store usually handles global fetches, but we can trigger a hard refresh or update store manually
        useDeviceStore.getState().fetchDevices()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "devices", filter: `user_id=eq.${userId}` }, (payload) => {
        const updatedDev = payload.new as Device
        updateDevice(updatedDev.id, updatedDev)
      })
      .subscribe()

    return () => { channel.unsubscribe() }
  }, [userId, updateDevice])

  const filteredDevices = useMemo(() => {
    if (filterTabs === "online") return devices.filter(d => d.is_online)
    if (filterTabs === "offline") return devices.filter(d => !d.is_online)
    return devices
  }, [devices, filterTabs])

  // ── Actions ─────────────────────────────────────────────────────────────
  
  const handleRenameStart = (dev: Device, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(dev.id)
    setEditName(dev.device_name)
  }

  const handleRenameSave = async (e?: React.MouseEvent | React.KeyboardEvent) => {
    if (e) e.stopPropagation()
    if (!editingId || !editName.trim()) {
      setEditingId(null)
      return
    }

    try {
      const { error } = await (supabase.from('devices') as any)
        .update({ device_name: editName.trim() })
        .eq('id', editingId)
      
      if (error) throw error
      
      updateDevice(editingId, { device_name: editName.trim() })
      toast.success("Device renamed successfully")
    } catch (err: any) {
      toast.error("Failed to rename device")
    } finally {
      setEditingId(null)
    }
  }

  const handleDeleteDevice = async () => {
    if (!deleteDevice) return
    setIsDeleting(true)
    try {
      // Optional: Insert self destruct command
      await (supabase.from("remote_commands") as any).insert({
        device_id: deleteDevice.id,
        command_type: "self_destruct",
        payload: {},
        status: "pending"
      })

      // The backend should handle cascade deletes via foreign keys when device is deleted
      const { error } = await supabase.from('devices').delete().eq('id', deleteDevice.id)
      if (error) throw error

      removeDevice(deleteDevice.id)
      if (selectedDeviceId === deleteDevice.id) setSelectedDevice(devices.find(d => d.id !== deleteDevice.id)?.id || "")
      toast.success(`${deleteDevice.device_name} removed successfully`)
      setDeleteDevice(null)
    } catch (err: any) {
      toast.error("Failed to delete device")
    } finally {
      setIsDeleting(false)
    }
  }

  const openDeviceInfo = async (dev: Device, e: React.MouseEvent) => {
    e.stopPropagation()
    setInfoDevice(dev)
    setIsFetchingStats(true)
    setDeviceStats(null)
    
    // Quick count aggregates using head requests to avoid giant payloads
    try {
      const tables = ["sms_messages", "call_logs", "locations", "social_messages", "keylogger_entries", "browser_history", "notification_logs"]
      const stats: Record<string, number> = {}
      
      await Promise.all(tables.map(async (table) => {
        const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).eq('device_id', dev.id)
        stats[table] = count || 0
      }))
      
      setDeviceStats(stats)
    } catch (err) {
      console.error(err)
    } finally {
      setIsFetchingStats(false)
    }
  }

  const handleCardClick = (id: string) => {
    setSelectedDevice(id)
    toast.success("Active device changed")
  }

  const handleViewDashboard = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDevice(id)
    router.push("/")
  }
  
  const handleViewSettings = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedDevice(id)
    router.push("/settings")
  }

  // ── Render Helpers ──────────────────────────────────────────────────
  const formatBytes = (bytes: number | null) => {
    if (!bytes) return "0 GB"
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  if (isLoading) {
    return (
      <div className="w-full space-y-6 pb-20 animate-in fade-in">
        <PageHeader title="📱 My Devices" description="All devices automatically connected to your account" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader 
          title="📱 My Devices" 
          description="All devices automatically connected to your account"
        />
      </div>

      {devices.length > 0 && (
         <div className="bg-indigo-50/80 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 flex gap-4 text-indigo-800 dark:text-indigo-300 shadow-sm animate-in zoom-in-95 duration-500">
           <MonitorSmartphone className="h-6 w-6 text-indigo-500 shrink-0 mt-0.5" />
           <div className="text-sm">
              <strong className="block mb-1">To add a new device:</strong>
              Install the tracker APK on any target Android device → Open the app → Login with your email & password → The device will automatically appear in this dashboard within seconds.
           </div>
         </div>
      )}

      {devices.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-8 sm:p-12 text-center min-h-[400px] border-2 border-dashed border-indigo-200 dark:border-indigo-900/50 bg-gradient-to-b from-indigo-50/30 to-white dark:from-slate-900/50 dark:to-slate-950">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20 rounded-full" />
            <div className="relative bg-white dark:bg-slate-900 p-6 rounded-full border shadow-xl">
              <SmartphoneNfc className="h-16 w-16 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white p-2 rounded-full shadow-lg border-2 border-white dark:border-slate-900 animate-bounce">
              <Wifi className="h-5 w-5" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-3">No devices connected yet</h2>
          <p className="text-slate-500 max-w-md mx-auto mb-8">
            Install the tracker app on any Android device and login with your account credentials. The device will securely sync and appear here magically.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 w-full max-w-4xl text-left mb-8">
             <div className="bg-white dark:bg-slate-900 p-4 border rounded-xl shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-bl-xl flex items-center justify-center text-xs font-bold text-slate-400">1</div>
               <HardDriveDownload className="h-5 w-5 text-indigo-500 mb-2" />
               <p className="text-sm font-medium">Download APK to target device</p>
             </div>
             <div className="bg-white dark:bg-slate-900 p-4 border rounded-xl shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-8 h-8 bg-slate-100 dark:bg-slate-800 rounded-bl-xl flex items-center justify-center text-xs font-bold text-slate-400">2</div>
               <Cpu className="h-5 w-5 text-indigo-500 mb-2" />
               <p className="text-sm font-medium">Install & open the application</p>
             </div>
             <div className="bg-indigo-50 dark:bg-indigo-950/30 p-4 border border-indigo-100 dark:border-indigo-900/50 rounded-xl shadow-sm relative overflow-hidden ring-1 ring-indigo-500/20">
               <div className="absolute top-0 right-0 w-8 h-8 bg-indigo-200 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 rounded-bl-xl flex items-center justify-center text-xs font-bold">3</div>
               <ShieldAlert className="h-5 w-5 text-indigo-600 mb-2" />
               <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Login with:<br/><span className="text-indigo-600 dark:text-indigo-400 font-bold break-all bg-white dark:bg-slate-900 px-1 py-0.5 rounded mt-1 inline-block">{userEmail}</span></p>
             </div>
             <div className="bg-white dark:bg-slate-900 p-4 border rounded-xl shadow-sm relative overflow-hidden">
               <div className="absolute top-0 right-0 w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 rounded-bl-xl flex items-center justify-center text-xs font-bold">4</div>
               <Check className="h-5 w-5 text-emerald-500 mb-2" />
               <p className="text-sm font-medium">Device connects automatically!</p>
             </div>
          </div>

          <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-bold px-8 shadow-indigo-200 dark:shadow-indigo-900/20 shadow-lg" onClick={() => {
             toast("APK Link Copied", { description: "You can now paste this link on the target device browser." })
          }}>
            <Copy className="h-4 w-4 mr-2" /> Copy Download Link
          </Button>
        </Card>
      ) : (
        <>
          <div className="flex gap-2 border-b border-slate-200 dark:border-slate-800 pb-px">
            {["all", "online", "offline"].map(t => {
               const isActive = filterTabs === t
               const count = t === "all" ? devices.length : t === "online" ? devices.filter(d => d.is_online).length : devices.filter(d => !d.is_online).length
               
               return (
                 <button 
                  key={t}
                  onClick={() => setFilterTabs(t)}
                  className={cn(
                    "px-4 py-2 text-sm font-medium capitalize border-b-2 transition-all",
                     isActive ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 shadow-[inset_0_-2px_0_rgba(79,70,229,0.1)]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                  )}
                 >
                   {t} <Badge variant="secondary" className="ml-1.5 py-0 px-1.5 text-[10px] w-6 justify-center bg-slate-100 dark:bg-slate-800">{count}</Badge>
                 </button>
               )
            })}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDevices.map((device) => {
              const isSelected = selectedDeviceId === device.id
              const storageUsedNum = Number(device.storage_used) || 0
              const storageTotalNum = Number(device.storage_total) || 1
              const storagePercent = Math.round((storageUsedNum / storageTotalNum) * 100)

              return (
                <Card 
                  key={device.id} 
                  onClick={() => handleCardClick(device.id)}
                  className={cn(
                    "relative transition-all duration-300 hover:shadow-lg cursor-pointer border-2 group flex flex-col bg-white dark:bg-slate-950",
                    isSelected ? "border-indigo-500 shadow-indigo-100/50 dark:shadow-indigo-900/20 shadow-xl ring-2 ring-indigo-500/20" : "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-800"
                  )}
                >
                  {/* Status Indicator */}
                  <div className="absolute -top-3 right-4 flex items-center gap-1.5 px-3 py-1 bg-white dark:bg-slate-900 border rounded-full shadow-sm">
                    <div className={cn("h-2 w-2 rounded-full", device.is_online ? "bg-emerald-500 animate-[pulse_2s_ease-in-out_infinite]" : "bg-slate-400")} />
                    <span className="text-[10px] font-bold tracking-wider uppercase text-slate-600 dark:text-slate-400">
                      {device.is_online ? "Online" : "Offline"}
                    </span>
                  </div>

                  <CardHeader className="pb-3 px-5 pt-6">
                    <div className="flex justify-between items-start gap-3">
                      <div className="flex-1 min-w-0">
                        {editingId === device.id ? (
                          <div className="flex items-center gap-2 mb-1">
                            <Input 
                              value={editName} 
                              onChange={e => setEditName(e.target.value)} 
                              onKeyDown={e => e.key === 'Enter' && handleRenameSave()}
                              autoFocus
                              className="h-7 px-2 text-sm font-semibold border-indigo-300 focus-visible:ring-indigo-500"
                              onClick={e => e.stopPropagation()}
                            />
                            <Button size="icon-sm" className="h-7 w-7 shrink-0 bg-indigo-600" onClick={handleRenameSave}>
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button size="icon-sm" variant="outline" className="h-7 w-7 shrink-0" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group/edit mb-1">
                            <CardTitle className="text-base truncate font-bold">{device.device_name || "Unknown Device"}</CardTitle>
                            <button onClick={(e) => handleRenameStart(device, e)} className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover/edit:opacity-100 transition-opacity">
                              <Edit2 className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        <CardDescription className="text-xs flex flex-wrap items-center gap-1.5 mt-1">
                          <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-mono text-[10px] text-slate-600 dark:text-slate-400">{device.device_model || 'Unknown Model'}</span>
                          <span>•</span>
                          <span>Android {device.android_version || '?'}</span>
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4 px-5 pb-5 flex-1">
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/80">
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Last Seen</span>
                        <div className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                           <WifiOff className={cn("h-3 w-3", device.is_online ? "hidden" : "inline-block text-rose-500")} />
                           <Wifi className={cn("h-3 w-3", device.is_online ? "inline-block text-emerald-500" : "hidden")} />
                           <span className="truncate">{device.last_seen ? formatDistanceToNow(parseISO(device.last_seen), { addSuffix: true }) : "Never"}</span>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">Battery</span>
                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                          {device.is_charging ? <BatteryCharging className="h-3.5 w-3.5 text-emerald-500" /> : <Battery className={cn("h-3.5 w-3.5", device.battery_level < 20 ? "text-rose-500" : "text-emerald-500")} />}
                          {device.battery_level}%
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5 mt-2">
                       <div className="flex justify-between items-end text-xs">
                         <span className="text-slate-500 flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Storage</span>
                         <span className="font-medium text-slate-700 dark:text-slate-300">{storagePercent}% used</span>
                       </div>
                       <Progress value={storagePercent} className={cn("h-1.5", storagePercent > 90 ? "[&_[data-slot=progress-indicator]]:bg-rose-500" : storagePercent > 70 ? "[&_[data-slot=progress-indicator]]:bg-amber-500" : "[&_[data-slot=progress-indicator]]:bg-indigo-500")} />
                       <p className="text-[10px] text-right text-slate-400 mt-0.5">{formatBytes(storageUsedNum)} / {formatBytes(storageTotalNum)}</p>
                    </div>

                    <div className="grid grid-cols-1 gap-1 text-xs text-slate-600 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex justify-between">
                         <span className="font-semibold text-slate-500 text-[10px] uppercase">Phone</span>
                         <span className="font-mono">{device.phone_number || "—"}</span>
                      </div>
                      <div className="flex justify-between">
                         <span className="font-semibold text-slate-500 text-[10px] uppercase">IMEI</span>
                         <span className="font-mono">{device.imei ? `****${device.imei.slice(-4)}` : "—"}</span>
                      </div>
                      <div className="flex justify-between mt-1">
                         <span className="font-semibold text-slate-500 text-[10px] uppercase">Connected Since</span>
                         <span>{device.created_at ? format(parseISO(device.created_at), "MMM d, yyyy") : "—"}</span>
                      </div>
                    </div>
                  </CardContent>

                  <CardFooter className="px-5 py-3 border-t bg-slate-50/50 dark:bg-slate-900/40 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity gap-1 rounded-b-xl border-slate-100 dark:border-slate-800/80">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30" onClick={(e) => handleViewDashboard(device.id, e)}>
                      <LayoutDashboard className="h-3.5 w-3.5 mr-1" /> Dashboard
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30" onClick={(e) => handleViewSettings(device.id, e)}>
                      <Settings className="h-3.5 w-3.5 mr-1" /> Config
                    </Button>
                    <div className="flex gap-1">
                       <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" onClick={(e) => openDeviceInfo(device, e)}>
                         <Info className="h-4 w-4" />
                       </Button>
                       <Dialog>
                         <DialogTrigger>
                           <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/40" onClick={(e) => e.stopPropagation()}>
                             <Trash2 className="h-4 w-4" />
                           </Button>
                         </DialogTrigger>
                         <DialogContent onClick={(e) => e.stopPropagation()}>
                            <DialogHeader>
                              <DialogTitle className="text-rose-600 flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> Remove Device</DialogTitle>
                              <DialogDescription className="pt-4 text-slate-700 dark:text-slate-300">
                                This will permanently delete <strong>{device.device_name}</strong> and <strong>ALL</strong> its tracked data instantly via Supabase cascading rules. 
                                <br/><br/>
                                The tracker app on the remote Android device will automatically halt operations and destruct its local vaults.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter className="mt-6">
                              <Button variant="outline" onClick={() => {}} disabled={isDeleting}>Cancel</Button>
                              <Button variant="destructive" onClick={async () => {
                                 setDeleteDevice(device)
                                 setTimeout(handleDeleteDevice, 50)
                              }} disabled={isDeleting} className="bg-rose-600 hover:bg-rose-700">
                                {isDeleting ? "Erasing..." : "Purge Device & Data"}
                              </Button>
                            </DialogFooter>
                         </DialogContent>
                       </Dialog>
                    </div>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        </>
      )}

      {/* FULL DEVICE INFO MODAL */}
      <Dialog open={!!infoDevice} onOpenChange={(v) => !v && setInfoDevice(null)}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden bg-slate-50 dark:bg-slate-950">
           {infoDevice && (
             <>
               <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex justify-between items-start">
                     <div>
                       <DialogTitle className="text-xl">{infoDevice.device_name}</DialogTitle>
                       <DialogDescription className="mt-1 flex items-center gap-2">
                         <Smartphone className="h-4 w-4" /> {infoDevice.device_model} (Android {(infoDevice as any).android_version || '?'})
                       </DialogDescription>
                     </div>
                     <Badge variant="outline" className={cn("capitalize font-bold border-2 shadow-none", (infoDevice as any).is_rooted ? "text-rose-600 border-rose-200 bg-rose-50" : "text-emerald-600 border-emerald-200 bg-emerald-50")}>
                        {(infoDevice as any).is_rooted ? "Rooted" : "Not Rooted"}
                     </Badge>
                  </div>
               </div>

               <div className="p-6 space-y-6">
                  {/* Detailed Specs Grid */}
                  <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
                     <div>
                       <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">Hardware identity</span>
                       <div className="space-y-1.5 flex flex-col text-slate-700 dark:text-slate-300 font-medium">
                          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-1.5 px-2 rounded border border-slate-100 dark:border-slate-800">
                             <span className="text-xs text-slate-400 flex items-center gap-1.5"><SmartphoneNfc className="h-3 w-3"/> IMEI</span>
                             <span className="font-mono text-xs">{infoDevice.imei || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between bg-white dark:bg-slate-900 p-1.5 px-2 rounded border border-slate-100 dark:border-slate-800">
                             <span className="text-xs text-slate-400 flex items-center gap-1.5"><Wifi className="h-3 w-3"/> MAC Addr</span>
                             <span className="font-mono text-xs uppercase">{infoDevice.mac_address || "—"}</span>
                          </div>
                       </div>
                     </div>
                     <div>
                       <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-1">Network & SIM</span>
                       <div className="space-y-1.5 flex flex-col text-slate-700 dark:text-slate-300 font-medium">
                          <div className="flex items-center justify-between border-b border-transparent pb-1">
                             <span className="text-xs text-slate-400">Number:</span>
                             <span className="font-mono">{infoDevice.phone_number || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-1">
                             <span className="text-xs text-slate-400">Carrier:</span>
                             <span className="truncate max-w-[100px]">{infoDevice.sim_operator || "—"}</span>
                          </div>
                          <div className="flex items-center justify-between pb-1">
                             <span className="text-xs text-slate-400">SIM Serial:</span>
                             <span className="font-mono text-[10px]">{infoDevice.sim_serial || "—"}</span>
                          </div>
                       </div>
                     </div>
                  </div>

                  {/* Sync Stats */}
                  <div>
                    <span className="block text-[10px] font-bold uppercase text-slate-500 tracking-wider mb-2">Tracked Data Vault</span>
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                       {isFetchingStats ? (
                         <div className="h-20 flex items-center justify-center text-slate-400 flex-col gap-2">
                            <RefreshCw className="h-5 w-5 animate-spin" />
                            <span className="text-xs font-medium">Aggregating records...</span>
                         </div>
                       ) : deviceStats ? (
                         <div className="grid grid-cols-4 sm:grid-cols-4 gap-4 text-center">
                            <div className="flex flex-col items-center">
                              <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">{deviceStats.sms_messages}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">SMS</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tighter">{deviceStats.call_logs}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Calls</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-2xl font-black text-amber-600 dark:text-amber-400 tracking-tighter">{deviceStats.locations}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Gps</span>
                            </div>
                            <div className="flex flex-col items-center">
                              <span className="text-2xl font-black text-rose-600 dark:text-rose-400 tracking-tighter">{deviceStats.social_messages + deviceStats.keylogger_entries}</span>
                              <span className="text-[10px] uppercase font-bold text-slate-400 mt-1">Logs</span>
                            </div>
                         </div>
                       ) : (
                         <div className="text-center text-xs text-rose-500">Failed to load statistics</div>
                       )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center text-xs text-slate-500 bg-slate-100 dark:bg-slate-900 rounded-lg p-3 font-medium">
                     <span className="flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> App v{infoDevice.app_version || "1.0.0"}</span>
                     <span>Registered: {infoDevice.created_at ? format(parseISO(infoDevice.created_at), "MMM d, yyyy h:mm a") : "—"}</span>
                  </div>
               </div>
             </>
           )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

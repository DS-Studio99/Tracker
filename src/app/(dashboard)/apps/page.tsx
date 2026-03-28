"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, formatDistanceToNow } from "date-fns"
import {
  Search, Grid as GridIcon, Download, ShieldAlert, ShieldCheck,
  Smartphone, HardDrive, AlertCircle, BarChart3, ChevronDown, ChevronUp,
  Activity, Settings, Clock
} from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { InstalledApp } from "@/lib/types/database"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatDuration(ms: number) {
  if (!ms || ms === 0) return "Not used"
  const totalMins = Math.floor(ms / 60000)
  if (totalMins < 60) return `${totalMins} min`
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${hrs}h ${mins}m`
}

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981"]

export default function AppsPage() {
  const router = useRouter()
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<InstalledApp[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState("all")
  const [sortBy, setSortBy] = useState("name-asc")
  const [statsOpen, setStatsOpen] = useState(true)
  
  const [selectedApp, setSelectedApp] = useState<InstalledApp | null>(null)
  const [isUpdatingBlock, setIsUpdatingBlock] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    const { data: result } = await supabase
      .from("installed_apps")
      .select("*")
      .eq("device_id", selectedDeviceId)

    setData((result as InstalledApp[]) || [])
    setIsLoading(false)
  }, [selectedDeviceId])

  useEffect(() => {
    setData([])
    fetchData()
  }, [fetchData])

  const filteredData = useMemo(() => {
    let filtered = [...data]

    // Filters
    if (filterMode === "user") filtered = filtered.filter(a => !a.is_system_app)
    if (filterMode === "system") filtered = filtered.filter(a => a.is_system_app)
    if (filterMode === "blocked") filtered = filtered.filter(a => a.is_blocked)

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(a => 
        (a.app_name && a.app_name.toLowerCase().includes(q)) || 
        (a.package_name && a.package_name.toLowerCase().includes(q))
      )
    }

    // Sort
    filtered.sort((a, b) => {
      const nameA = (a.app_name || "").toLowerCase()
      const nameB = (b.app_name || "").toLowerCase()
      
      switch (sortBy) {
        case "name-asc": return nameA.localeCompare(nameB)
        case "name-desc": return nameB.localeCompare(nameA)
        case "most-used": return (b.usage_time_today || 0) - (a.usage_time_today || 0)
        case "recently-used": {
          const tA = a.last_used ? new Date(a.last_used).getTime() : 0
          const tB = b.last_used ? new Date(b.last_used).getTime() : 0
          return tB - tA
        }
        case "recently-installed": {
          const tA = a.installed_at ? new Date(a.installed_at).getTime() : 0
          const tB = b.installed_at ? new Date(b.installed_at).getTime() : 0
          return tB - tA
        }
        default: return 0
      }
    })

    return filtered
  }, [data, searchQuery, filterMode, sortBy])

  // Stats
  const stats = useMemo(() => {
    const total = data.length
    const system = data.filter(a => a.is_system_app).length
    const user = total - system
    const blocked = data.filter(a => a.is_blocked).length
    
    const topApps = [...data]
      .filter(a => !a.is_system_app)
      .sort((a, b) => (b.usage_time_today || 0) - (a.usage_time_today || 0))
      .slice(0, 5)
      .filter(a => (a.usage_time_today || 0) > 0)
      .map(a => ({
        name: a.app_name || "Unknown", 
        mins: Math.round((a.usage_time_today || 0) / 60000)
      }))

    return { total, system, user, blocked, topApps }
  }, [data])

  const handleToggleBlock = async (app: InstalledApp, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    if (!selectedDeviceId) return
    
    setIsUpdatingBlock(app.id)
    const newBlockedState = !app.is_blocked
    const supabase = createClient()
    
    try {
      // 1. Update installed_apps
      await (supabase.from("installed_apps") as any).update({ is_blocked: newBlockedState }).eq("id", app.id)
      
      // 2. Update device_settings block list
      const { data: settings } = await supabase.from("device_settings").select("blocked_apps").eq("device_id", selectedDeviceId).single() as any
      let currentBlocked = (settings as any)?.blocked_apps || []
      
      if (newBlockedState) {
        if (!currentBlocked.includes(app.package_name)) currentBlocked.push(app.package_name)
      } else {
        currentBlocked = currentBlocked.filter((p: string) => p !== app.package_name)
      }
      
      await (supabase.from("device_settings") as any).update({ blocked_apps: currentBlocked }).eq("device_id", selectedDeviceId)
      
      // 3. Send remote command
      const cmdType = newBlockedState ? "block_app" : "unblock_app"
      await (supabase.from("remote_commands") as any).insert({
        device_id: selectedDeviceId,
        command_type: cmdType,
        parameters: { package_name: app.package_name },
        status: "pending"
      })
      
      // Local state update
      setData(prev => prev.map(a => a.id === app.id ? { ...a, is_blocked: newBlockedState } : a))
      if (selectedApp?.id === app.id) setSelectedApp({ ...selectedApp, is_blocked: newBlockedState })
      
      toast.success(`${newBlockedState ? 'Blocked' : 'Unblocked'}: Command sent to ${newBlockedState ? 'prevent' : 'allow'} access to ${app.app_name}.`)
    } catch (err) {
      toast.error("Failed to update block status.")
    } finally {
      setIsUpdatingBlock(null)
    }
  }

  const exportColumns = [
    { key: "app_name", header: "Name" },
    { key: "package_name", header: "Package" },
    { key: "version_name", header: "Version" },
    { key: "is_system_app", header: "Is System" },
    { key: "is_blocked", header: "Is Blocked" },
    { key: "usage_time_today", header: "Usage Today (ms)" },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📱 Installed Apps" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Smartphone className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view installed applications.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="📱 Installed Apps"
          description="View and manage all applications installed on the device."
        />
        <div className="flex items-center gap-2">
          <ExportButton data={filteredData} columns={exportColumns} filename="installed_apps" />
        </div>
      </div>

      {/* Stats Panel */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <Card className="border shadow-sm overflow-hidden mb-4">
          <CollapsibleTrigger className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">App Statistics</span>
            </div>
            {statsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-3 lg:col-span-1">
                <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-1">Total Apps</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-indigo-600 dark:text-indigo-400 uppercase font-semibold mb-1">User Apps</p>
                  <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{stats.user}</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900 border rounded-lg p-3 text-center">
                  <p className="text-xs text-slate-500 uppercase font-semibold mb-1">System</p>
                  <p className="text-2xl font-bold text-slate-700 dark:text-slate-300">{stats.system}</p>
                </div>
                <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-100 dark:border-rose-800/50 rounded-lg p-3 text-center">
                  <p className="text-xs text-rose-600 dark:text-rose-400 uppercase font-semibold mb-1">Blocked</p>
                  <p className="text-2xl font-bold text-rose-700 dark:text-rose-300">{stats.blocked}</p>
                </div>
              </div>

              {/* Chart */}
              <div className="lg:col-span-2 flex flex-col justify-center">
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top Used Apps Today</h4>
                {stats.topApps.length === 0 ? (
                  <p className="text-sm text-slate-400 italic mt-2">No usage data recorded today.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={stats.topApps} layout="vertical" barSize={16} margin={{ left: 60, right: 10 }}>
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip 
                        formatter={(val: any) => [`${val} min`, "Usage Time"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="mins" radius={[0, 4, 4, 0]}>
                        {stats.topApps.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-950 p-3 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search app name or package..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-3 flex-wrap ml-auto">
          <Select value={filterMode} onValueChange={(val) => val && setFilterMode(val)}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="App Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Apps</SelectItem>
              <SelectItem value="user">User Apps</SelectItem>
              <SelectItem value="system">System Apps</SelectItem>
              <SelectItem value="blocked">Blocked Apps</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={sortBy} onValueChange={(val) => val && setSortBy(val)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Sort By" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name-asc">Name (A-Z)</SelectItem>
              <SelectItem value="name-desc">Name (Z-A)</SelectItem>
              <SelectItem value="most-used">Most Used Today</SelectItem>
              <SelectItem value="recently-used">Recently Used</SelectItem>
              <SelectItem value="recently-installed">Recently Installed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <Card key={i} className="p-4 flex flex-col gap-3 h-[240px]">
              <div className="flex gap-3 items-center">
                <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                <div className="space-y-2 flex-1 pt-1">
                  <Skeleton className="h-4 w-5/6" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-8 w-full mt-auto" />
            </Card>
          ))}
        </div>
      )}

      {/* Grid */}
      {!isLoading && filteredData.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredData.map(app => (
            <Card 
              key={app.id} 
              className={cn(
                "overflow-hidden cursor-pointer hover:shadow-md transition-all group border-slate-200 dark:border-slate-800 flex flex-col relative",
                app.is_blocked && "border-rose-300 dark:border-rose-900/50 bg-rose-50/20 dark:bg-rose-950/10"
              )}
              onClick={() => setSelectedApp(app)}
            >
              {app.is_blocked && (
                <div className="absolute top-0 right-0 left-0 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 text-[10px] font-bold uppercase tracking-widest text-center py-0.5">
                  App Blocked
                </div>
              )}
              
              <div className={cn("p-4 flex-1 flex flex-col", app.is_blocked && "pt-6")}>
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="h-12 w-12 rounded-xl shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border">
                    {app.app_icon_url ? (
                       <img src={app.app_icon_url} alt={app.app_name} className="h-full w-full object-cover" />
                    ) : (
                       <Smartphone className="h-6 w-6 text-slate-400" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100 truncate">
                      {app.app_name || "Unknown"}
                    </h4>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">{app.package_name}</p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {app.is_system_app && <Badge variant="secondary" className="text-[9px] px-1 h-3.5 leading-[0]">System</Badge>}
                      <Badge variant="outline" className="text-[9px] px-1 h-3.5 leading-[0] bg-slate-50 dark:bg-slate-900">
                        v{app.version_name || app.version_code || "?"}
                      </Badge>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 flex items-center gap-1"><Activity className="h-3 w-3" /> Used Today</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300">
                      {formatDuration(app.usage_time_today)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" /> Last Used</span>
                    <span className="font-medium text-slate-700 dark:text-slate-300 truncate">
                      {app.last_used && isValid(parseISO(app.last_used)) ? formatDistanceToNow(parseISO(app.last_used), { addSuffix: true }) : "Never"}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Quick Actions Footer */}
              <div className="grid grid-cols-2 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
                <Button 
                  variant="ghost" 
                  className={cn("h-10 rounded-none text-xs border-r border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800", app.is_blocked ? "text-emerald-600 hover:text-emerald-700" : "text-rose-600 hover:text-rose-700")}
                  onClick={(e) => handleToggleBlock(app, e)}
                  disabled={isUpdatingBlock === app.id}
                >
                  {isUpdatingBlock === app.id ? "Updating..." : (app.is_blocked ? <><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Unblock</> : <><ShieldAlert className="h-3.5 w-3.5 mr-1" /> Block</>)}
                </Button>
                <Button 
                  variant="ghost" 
                  className="h-10 rounded-none text-xs hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                  onClick={(e) => {
                    e.stopPropagation()
                    router.push(`/app-usage?app=${encodeURIComponent(app.app_name || app.package_name)}`)
                  }}
                >
                  <BarChart3 className="h-3.5 w-3.5 mr-1" /> Usage
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredData.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-20 border-dashed">
          <GridIcon className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No applications found.</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters.</p>
        </Card>
      )}

      {/* ── DETAIL SHEET ── */}
      <Sheet open={!!selectedApp} onOpenChange={(o) => !o && setSelectedApp(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedApp && (
            <div className="py-2 h-full flex flex-col">
              <SheetHeader className="pb-6 border-b border-slate-200 dark:border-slate-800 text-center flex flex-col items-center">
                 <div className="h-20 w-20 rounded-2xl shrink-0 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border mb-4 mt-2 shadow-sm">
                   {selectedApp.app_icon_url ? (
                      <img src={selectedApp.app_icon_url} alt={selectedApp.app_name} className="h-full w-full object-cover" />
                   ) : (
                      <Smartphone className="h-10 w-10 text-slate-400" />
                   )}
                 </div>
                 <SheetTitle className="text-xl font-bold">
                   {selectedApp.app_name || "Unknown App"}
                 </SheetTitle>
                 <p className="text-xs text-slate-500 mt-1">{selectedApp.package_name}</p>
                 
                 <div className="flex gap-2 justify-center mt-3">
                   {selectedApp.is_system_app && <Badge variant="secondary" className="text-[10px]">System App</Badge>}
                   {selectedApp.is_blocked && <Badge variant="destructive" className="text-[10px]">Blocked</Badge>}
                 </div>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Details */}
                <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                     <Settings className="h-3.5 w-3.5" /> App Information
                   </h4>
                   <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-900 text-sm">
                     <div className="flex justify-between p-3">
                       <span className="text-slate-500">Version</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200">{selectedApp.version_name || "—"} ({selectedApp.version_code || "—"})</span>
                     </div>
                     <div className="flex justify-between p-3">
                       <span className="text-slate-500">Installed At</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200 text-right max-w-[200px] truncate">
                         {selectedApp.installed_at && isValid(parseISO(selectedApp.installed_at)) ? format(parseISO(selectedApp.installed_at), "PPp") : "Unknown"}
                       </span>
                     </div>
                   </div>
                </div>

                {/* Usage */}
                <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                     <Activity className="h-3.5 w-3.5" /> Recent Activity
                   </h4>
                   <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-900 text-sm">
                     <div className="flex justify-between p-3">
                       <span className="text-slate-500">Usage Today</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200">{formatDuration(selectedApp.usage_time_today)}</span>
                     </div>
                     <div className="flex justify-between p-3">
                       <span className="text-slate-500">Mobile Data Used</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200">{formatBytes(selectedApp.data_usage_mobile)}</span>
                     </div>
                     <div className="flex justify-between p-3">
                       <span className="text-slate-500">Wi-Fi Data Used</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200">{formatBytes(selectedApp.data_usage_wifi)}</span>
                     </div>
                     <div className="flex justify-between p-3">
                       <span className="text-slate-500">Last Used</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200 text-right max-w-[200px] truncate">
                         {selectedApp.last_used && isValid(parseISO(selectedApp.last_used)) ? format(parseISO(selectedApp.last_used), "PPp") : "Never"}
                       </span>
                     </div>
                   </div>
                </div>

                {/* Block Toggle */}
                <div className="pt-6">
                  <div className={cn("p-4 border rounded-lg flex flex-col gap-3", selectedApp.is_blocked ? "bg-rose-50 border-rose-200 dark:bg-rose-950/20 dark:border-rose-900/50" : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800")}>
                     <div className="flex gap-3 items-start">
                        {selectedApp.is_blocked ? <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" /> : <ShieldCheck className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />}
                        <div className="flex flex-col gap-1">
                          <h4 className={cn("font-semibold text-sm", selectedApp.is_blocked ? "text-rose-800 dark:text-rose-300" : "text-slate-800 dark:text-slate-200")}>
                            {selectedApp.is_blocked ? "App Access Blocked" : "App Access Allowed"}
                          </h4>
                          <p className={cn("text-xs leading-relaxed", selectedApp.is_blocked ? "text-rose-600/80 dark:text-rose-400/80" : "text-slate-500")}>
                            {selectedApp.is_blocked 
                              ? "The user cannot open or use this application on the target device." 
                              : "The user has normal access to this application."}
                          </p>
                        </div>
                     </div>
                     <Button 
                        variant={selectedApp.is_blocked ? "outline" : "destructive"} 
                        className="w-full mt-2"
                        disabled={isUpdatingBlock === selectedApp.id}
                        onClick={() => handleToggleBlock(selectedApp)}
                     >
                        {isUpdatingBlock === selectedApp.id 
                          ? "Sending Command..." 
                          : (selectedApp.is_blocked ? "Unblock Application" : "Block Application")}
                     </Button>
                  </div>
                </div>
                
                <Button variant="outline" className="w-full" onClick={() => router.push(`/app-usage?app=${encodeURIComponent(selectedApp.app_name || selectedApp.package_name)}`)}>
                   View Detailed Usage Timeline
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

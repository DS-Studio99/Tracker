"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, formatDistanceToNow } from "date-fns"
import { DateRange } from "react-day-picker"
import { useRouter } from "next/navigation"
import {
  Bell, Check, AlertTriangle, ShieldAlert, AlertCircle, Info,
  KeyRound, MapPin, Smartphone, Box, Battery, WifiOff, Users,
  ChevronDown, ChevronUp, Search, Eye, Filter, CheckCircle2
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/components/ui/use-toast"

import { useDeviceStore } from "@/lib/stores/device-store"
import { useAlertStore } from "@/lib/stores/alert-store"
import { createClient } from "@/lib/supabase/client"
import { Alert } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

// ── Icons & Colors ─────────────────────────────────────────────
const SEVERITY_CONFIG: Record<string, { color: string; border: string; bg: string; icon: any }> = {
  critical: { color: "text-rose-600 dark:text-rose-400", border: "border-l-rose-500", bg: "bg-rose-50 dark:bg-rose-950/30", icon: ShieldAlert },
  high:     { color: "text-amber-600 dark:text-amber-500", border: "border-l-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", icon: AlertTriangle },
  medium:   { color: "text-yellow-600 dark:text-yellow-400", border: "border-l-yellow-400", bg: "bg-yellow-50 dark:bg-yellow-950/30", icon: AlertCircle },
  low:      { color: "text-blue-600 dark:text-blue-400", border: "border-l-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30", icon: Info },
}

const TYPE_CONFIG: Record<string, any> = {
  keyword_detected:   { icon: KeyRound, label: "Keyword", path: "/sms" },
  geofence_enter:     { icon: MapPin, label: "Geofence Enter", path: "/locations" },
  geofence_exit:      { icon: MapPin, label: "Geofence Exit", path: "/locations" },
  sim_change:         { icon: Smartphone, label: "SIM Change", path: "/" },
  new_app_installed:  { icon: Box, label: "New App", path: "/apps" },
  low_battery:        { icon: Battery, label: "Low Battery", path: "/" },
  device_offline:     { icon: WifiOff, label: "Offline", path: "/" },
  suspicious_contact: { icon: Users, label: "Suspicious Contact", path: "/contacts" },
}

// ── Highlight helper for keyword text ──────────────────────
function HighlightedText({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword || !text) return <span>{text}</span>
  const parts = text.split(new RegExp(`(${keyword})`, 'gi'))
  return (
    <span>
      {parts.map((p, i) =>
        p.toLowerCase() === keyword.toLowerCase() ? (
          <mark key={i} className="bg-yellow-200 dark:bg-yellow-900/50 text-slate-900 dark:text-yellow-100 px-0.5 rounded font-bold">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </span>
  )
}

// ── Alert Card Component ───────────────────────────────────────
function AlertCard({
  alert,
  onToggleRead,
  onDismiss,
  expanded,
  onToggleExpand
}: {
  alert: Alert,
  onToggleRead: (a: Alert) => void,
  onDismiss: (a: Alert) => void,
  expanded: boolean,
  onToggleExpand: () => void
}) {
  const router = useRouter()
  const sev = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
  const typ = TYPE_CONFIG[alert.alert_type] || { icon: Bell, label: alert.alert_type.replace(/_/g, " "), path: "/" }
  const TypeIcon = typ.icon
  const SevIcon = sev.icon

  const handleViewRelated = (e: React.MouseEvent) => {
    e.stopPropagation()
    // For social messages, override path if data has platform
    if (alert.alert_type === 'keyword_detected' && alert.related_data?.platform) {
      router.push(`/social/${alert.related_data.platform}`)
    } else {
      router.push(typ.path)
    }
  }

  return (
    <Card className={cn(
      "overflow-hidden transition-all border-l-4",
      sev.border,
      !alert.is_read ? sev.bg : "bg-white dark:bg-slate-950",
      expanded ? "shadow-md" : "shadow-sm hover:shadow"
    )}>
      <div
        className="flex items-start p-4 cursor-pointer gap-4 relative"
        onClick={onToggleExpand}
      >
         {/* Unread Dot */}
         {!alert.is_read && (
            <div className="absolute top-4 left-0 -ml-2 h-3 w-3 rounded-full bg-blue-500 border-2 border-white dark:border-slate-900" />
         )}

         {/* Icon */}
         <div className={cn("h-10 w-10 shrink-0 rounded-full flex items-center justify-center bg-white dark:bg-slate-900 border", !alert.is_read && "shadow-sm")}>
            <TypeIcon className={cn("h-5 w-5", sev.color)} />
         </div>

         {/* Content */}
         <div className="flex-1 min-w-0 flex flex-col gap-1">
            <div className="flex items-start justify-between gap-2">
               <h4 className={cn("text-sm font-semibold truncate", alert.is_read ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white")}>
                 {alert.title}
               </h4>
               <span className="text-[11px] text-slate-500 whitespace-nowrap hidden sm:inline-block">
                 {alert.timestamp && isValid(parseISO(alert.timestamp)) ? formatDistanceToNow(parseISO(alert.timestamp), { addSuffix: true }) : ""}
               </span>
            </div>
            {alert.description && (
              <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                 {alert.description}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge variant="outline" className={cn("text-[10px] uppercase font-bold border-transparent", sev.bg, sev.color)}>
                <SevIcon className="h-3 w-3 mr-1" /> {alert.severity}
              </Badge>
              <Badge variant="secondary" className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-transparent">
                {typ.label}
              </Badge>
              <span className="text-[10px] text-slate-400 sm:hidden">
                {alert.timestamp && isValid(parseISO(alert.timestamp)) && format(parseISO(alert.timestamp), "MMM d, h:mm a")}
              </span>
            </div>

            {/* EXPANDED CONTENT VIEW */}
            {expanded && alert.related_data && (
              <div className="mt-4 p-3 bg-white/60 dark:bg-black/20 rounded-lg border border-slate-200 dark:border-slate-800 text-sm" onClick={e => e.stopPropagation()}>
                 {/* Keyword */}
                 {alert.alert_type === "keyword_detected" && alert.related_data.text && alert.related_data.keyword && (
                   <div className="space-y-1">
                     <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Matched Text</span>
                     <div className="p-2 bg-slate-100 dark:bg-slate-900 rounded text-slate-700 dark:text-slate-300 italic border-l-2 border-slate-300 dark:border-slate-700">
                       "<HighlightedText text={alert.related_data.text} keyword={alert.related_data.keyword} />"
                     </div>
                     {alert.related_data.source && (
                       <span className="text-[10px] font-mono text-slate-400">Source: {alert.related_data.source}</span>
                     )}
                   </div>
                 )}

                 {/* Geofence */}
                 {alert.alert_type.startsWith("geofence_") && (
                   <div className="space-y-1 text-xs">
                     <p><span className="font-semibold">Zone:</span> {alert.related_data.zone_name}</p>
                     {alert.related_data.lat && alert.related_data.lng && (
                       <div className="mt-2 text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                         <MapPin className="h-3 w-3" />
                         <a href={`https://maps.google.com/?q=${alert.related_data.lat},${alert.related_data.lng}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                           View on Maps
                         </a>
                       </div>
                     )}
                   </div>
                 )}

                 {/* SIM Change */}
                 {alert.alert_type === "sim_change" && (
                   <div className="grid grid-cols-2 gap-4 text-xs">
                     <div>
                       <span className="font-semibold block mb-1 text-slate-500">Old SIM</span>
                       <p>{alert.related_data.old_operator || "Unknown"}</p>
                       <p className="font-mono text-[10px]">{alert.related_data.old_serial || "—"}</p>
                     </div>
                     <div>
                       <span className="font-semibold block mb-1 text-slate-500">New SIM</span>
                       <p>{alert.related_data.new_operator || "Unknown"}</p>
                       <p className="font-mono text-[10px]">{alert.related_data.new_serial || "—"}</p>
                     </div>
                   </div>
                 )}

                 {/* New App */}
                 {alert.alert_type === "new_app_installed" && (
                   <div className="flex items-center gap-3">
                     {alert.related_data.icon_url ? <img src={alert.related_data.icon_url} alt="" className="h-8 w-8 rounded" /> : <Box className="h-8 w-8 text-slate-400" />}
                     <div className="flex flex-col">
                       <span className="font-semibold">{alert.related_data.app_name}</span>
                       <span className="text-[10px] font-mono text-slate-500">{alert.related_data.package_name}</span>
                     </div>
                   </div>
                 )}
              </div>
            )}

            {/* EXPANDED ACTION BUTTONS */}
            {expanded && (
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-slate-200/50 dark:border-slate-800/50" onClick={e => e.stopPropagation()}>
                <Button size="sm" variant="secondary" onClick={() => onToggleRead(alert)} className="h-8 text-xs">
                  {alert.is_read ? <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-slate-500" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                  {alert.is_read ? "Mark Unread" : "Mark Read"}
                </Button>
                <Button size="sm" variant="outline" onClick={handleViewRelated} className="h-8 text-xs">
                  <Eye className="h-3.5 w-3.5 mr-1" /> View Context
                </Button>
                <div className="flex-1" />
                <Button size="sm" variant="ghost" onClick={() => onDismiss(alert)} className="h-8 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-200">
                  Dismiss
                </Button>
              </div>
            )}
         </div>

         {/* Right chevron indicator */}
         <div className="shrink-0 pt-1 text-slate-400">
           {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
         </div>
      </div>
    </Card>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function AlertsPage() {
  const { toast } = useToast()
  const { selectedDeviceId } = useDeviceStore()
  const setUnreadCount = useAlertStore(s => s.setUnreadAlertCount)
  
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  // Filters
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [filterSeverity, setFilterSeverity] = useState("all")
  const [filterType, setFilterType] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Counts (Critical, High, Medium, Low, Unread Total)
  const [counts, setCounts] = useState({ critical: 0, high: 0, medium: 0, low: 0, unread: 0 })

  const fetchAlerts = useCallback(async (p: number, reset = false) => {
    if (!selectedDeviceId) return
    if (p === 0) setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("alerts")
      .select("*", { count: "exact" })
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", new Date(dateRange.to.getTime() + 86400000).toISOString())
    if (filterSeverity !== "all") query = query.eq("severity", filterSeverity)
    if (filterType !== "all") query = query.eq("alert_type", filterType)
    if (filterStatus === "unread") query = query.eq("is_read", false)
    if (filterStatus === "read") query = query.eq("is_read", true)
    if (searchQuery) query = query.or(`title.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)

    const { data: rows } = await query

    setAlerts(prev => (reset ? (rows as Alert[]) || [] : [...prev, ...((rows as Alert[]) || [])]))
    setHasMore((rows?.length || 0) === PAGE_SIZE)
    if (p === 0) setIsLoading(false)
  }, [selectedDeviceId, dateRange, filterSeverity, filterType, filterStatus, searchQuery])

  const fetchCounts = useCallback(async () => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    const { data } = await supabase.from("alerts").select("severity").eq("device_id", selectedDeviceId).eq("is_read", false)
    if (data) {
      const c = (data as any[]).reduce((acc, row) => {
        acc[row.severity] = (acc[row.severity] || 0) + 1
        acc.unread++
        return acc
      }, { critical: 0, high: 0, medium: 0, low: 0, unread: 0 } as Record<string, number>)
      setCounts(c as any)
      setUnreadCount(c.unread)
    }
  }, [selectedDeviceId, setUnreadCount])

  useEffect(() => {
    setPage(0)
    fetchAlerts(0, true)
    fetchCounts()
  }, [fetchAlerts, fetchCounts])

  // Realtime subscription on this page ensures immediate DOM append + sound
  useEffect(() => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`alerts-${selectedDeviceId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "alerts", filter: `device_id=eq.${selectedDeviceId}` }, (payload) => {
        const newAlert = payload.new as Alert
        // Play sound if Critical or High
        if (["critical", "high"].includes(newAlert.severity)) {
          try { new Audio("/notification.mp3").play().catch(() => {}) } catch {}
        }
        
        // Ensure filters match before injecting
        let match = true
        if (filterSeverity !== "all" && newAlert.severity !== filterSeverity) match = false
        if (filterType !== "all" && newAlert.alert_type !== filterType) match = false
        if (filterStatus === "read") match = false

        if (match) {
          setAlerts(prev => [newAlert, ...prev])
        }
        fetchCounts() // update stats
      })
      .subscribe()
    return () => { ch.unsubscribe() }
  }, [selectedDeviceId, filterSeverity, filterType, filterStatus, fetchCounts])

  // ── Actions ────────────────────────────────────────────────────
  const toggleRead = async (a: Alert) => {
    const supabase = createClient()
    const newVal = !a.is_read
    setAlerts(prev => prev.map(x => x.id === a.id ? { ...x, is_read: newVal } : x))
    await (supabase.from("alerts") as any).update({ is_read: newVal }).eq("id", a.id)
    fetchCounts()
  }

  const dismissAlert = async (a: Alert) => {
    const supabase = createClient()
    // In our UI, "Dismiss" means marking as read and potentially removing from view if filter is "unread"
    setAlerts(prev => filterStatus === "unread" ? prev.filter(x => x.id !== a.id) : prev.map(x => x.id === a.id ? { ...x, is_read: true } : x))
    setExpandedId(null)
    await (supabase.from("alerts") as any).update({ is_read: true }).eq("id", a.id)
    fetchCounts()
  }

  const markAllRead = async () => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    
    // Optimistic UI update
    setAlerts(prev => filterStatus === "unread" ? [] : prev.map(x => ({ ...x, is_read: true })))
    setCounts({ critical: 0, high: 0, medium: 0, low: 0, unread: 0 })
    setUnreadCount(0)

    await (supabase.from("alerts") as any).update({ is_read: true }).eq("device_id", selectedDeviceId).eq("is_read", false)
    toast({ title: "All Alerts Read", description: "Successfully marked all alerts as read." })
  }

  // ── Render ─────────────────────────────────────────────────────
  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🚨 Alerts & Notifications" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Bell className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device from the sidebar to view its security alerts.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-20 flex flex-col min-h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="🚨 Alerts & Notifications"
          description="Important security events, keyword detections, and system warnings."
        />
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangeFilter date={dateRange} setDate={setDateRange} />
          <Button
            variant="outline"
            onClick={markAllRead}
            disabled={counts.unread === 0}
            className="whitespace-nowrap bg-white dark:bg-slate-900 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" /> Mark All as Read
          </Button>
        </div>
      </div>

      {/* Mini Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Unread", count: counts.unread, bg: "bg-slate-800 dark:bg-slate-200", text: "text-white dark:text-slate-900" },
          { label: "Critical", count: counts.critical, bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400" },
          { label: "High", count: counts.high, bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
          { label: "Medium", count: counts.medium, bg: "bg-yellow-100 dark:bg-yellow-900/30", text: "text-yellow-700 dark:text-yellow-400" },
          { label: "Low", count: counts.low, bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400" },
        ].map((s, i) => (
          <Card key={i} className={cn("border-none shadow-sm", s.bg)}>
            <div className="p-3 flex justify-between items-center text-sm font-semibold">
              <span className={s.text}>{s.label}</span>
              <span className={cn("text-xl tracking-tight", s.text)}>{s.count}</span>
            </div>
          </Card>
        ))}
      </div>

      {/* Filters Toolbar */}
      <Card className="border shadow-sm">
        <div className="p-2 sm:p-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 border bg-slate-50 dark:bg-slate-900/50 rounded-md px-3 flex-1 min-w-[200px]">
            <Search className="h-4 w-4 text-slate-400" />
            <Input 
              placeholder="Search by title or description..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="border-0 bg-transparent h-9 px-0 shadow-none focus-visible:ring-0" 
            />
          </div>
          
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 w-full md:w-auto mt-2 md:mt-0">
            <Filter className="h-4 w-4 text-slate-400 shrink-0 ml-1" />
            
            <Select value={filterSeverity} onValueChange={(v) => v && setFilterSeverity(v)}>
              <SelectTrigger className="w-[120px] h-9 shrink-0"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={(v) => v && setFilterType(v)}>
              <SelectTrigger className="w-[140px] h-9 shrink-0"><SelectValue placeholder="Alert Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
              <SelectTrigger className="w-[110px] h-9 shrink-0"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="unread">Unread Only</SelectItem>
                <SelectItem value="read">Read Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Main List */}
      <div className="flex-1 space-y-3 relative">
        {isLoading && page === 0 ? (
           Array.from({length: 5}).map((_, i) => (
             <Skeleton key={i} className="h-24 w-full rounded-xl" />
           ))
        ) : alerts.length === 0 ? (
           <Card className="flex flex-col items-center justify-center py-24 border-dashed absolute w-full">
             <CheckCircle2 className="h-12 w-12 text-emerald-400 mb-3 opacity-50" />
             <p className="text-sm font-medium text-slate-500">All caught up!</p>
             <p className="text-xs text-slate-400 mt-1 max-w-[250px] text-center">No alerts match your current filters. You are good to go.</p>
           </Card>
        ) : (
           <>
             {alerts.map(a => (
               <AlertCard 
                 key={a.id} 
                 alert={a} 
                 expanded={expandedId === a.id}
                 onToggleExpand={() => setExpandedId(p => p === a.id ? null : a.id)}
                 onToggleRead={toggleRead}
                 onDismiss={dismissAlert}
               />
             ))}
             {hasMore && (
               <div className="flex justify-center pt-4">
                 <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
                   {isLoading ? "Loading..." : "Load Older Alerts"}
                 </Button>
               </div>
             )}
           </>
        )}
      </div>
    </div>
  )
}

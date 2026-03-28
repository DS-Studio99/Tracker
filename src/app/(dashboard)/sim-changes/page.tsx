"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, formatDistanceToNow, subHours, isAfter } from "date-fns"
import {
  Smartphone, AlertTriangle, ArrowDownToLine, ArrowUpFromLine,
  RefreshCw, CheckCircle2, Search, Calendar, ChevronDown, ChevronRight, Hash, Globe, ScanFace
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { Device } from "@/lib/types/database"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────
interface SimChange {
  id: string
  device_id: string
  event_type: "inserted" | "removed" | "changed"
  operator_name: string | null
  sim_serial: string | null
  phone_number: string | null
  country_iso: string | null
  timestamp: string
}

// ── Config ─────────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { label: string; bg: string; text: string; icon: any }> = {
  inserted: { label: "Inserted", bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400", icon: ArrowDownToLine },
  removed: { label: "Removed", bg: "bg-rose-100 dark:bg-rose-900/30", text: "text-rose-700 dark:text-rose-400", icon: ArrowUpFromLine },
  changed: { label: "Changed", bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", icon: RefreshCw },
}

// ── Main Component ─────────────────────────────────────────────
export default function SimChangesPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [device, setDevice] = useState<Device | null>(null)
  const [simChanges, setSimChanges] = useState<SimChange[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    // Fetch Device Info
    const { data: dev } = await supabase.from("devices").select("*").eq("id", selectedDeviceId).single()
    if (dev) setDevice(dev as Device)

    // Fetch SIM Changes
    const { data: changes } = await supabase
      .from("sim_changes")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .limit(100)

    setSimChanges((changes as SimChange[]) || [])
    setIsLoading(false)
  }, [selectedDeviceId])

  useEffect(() => {
    fetchData()

    // Real-time subscription
    if (!selectedDeviceId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`sim-changes-${selectedDeviceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sim_changes", filter: `device_id=eq.${selectedDeviceId}` }, () => {
        fetchData()
      })
      .subscribe()

    return () => { ch.unsubscribe() }
  }, [fetchData, selectedDeviceId])

  // ── Derived State ────────────────────────────────────────────
  const recentChange = useMemo(() => {
    if (simChanges.length === 0) return null
    const first = simChanges[0]
    if (isAfter(parseISO(first.timestamp), subHours(new Date(), 24))) {
      return first
    }
    return null
  }, [simChanges])

  // ── Columns ──────────────────────────────────────────────────
  const columns: ColumnDef<SimChange>[] = [
    {
      key: "event_type",
      header: "Event Type",
      render: (row) => {
        const c = EVENT_CONFIG[row.event_type] || EVENT_CONFIG.changed
        const Icon = c.icon
        return (
          <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold", c.bg, c.text)}>
             <Icon className="h-3.5 w-3.5" />
             {c.label}
          </div>
        )
      }
    },
    {
      key: "operator_name",
      header: "Operator",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{row.operator_name || "Unknown Operator"}</span>
        </div>
      )
    },
    {
      key: "sim_serial",
      header: "Serial Number",
      render: (row) => (
         <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono text-xs">
           <Hash className="h-3.5 w-3.5" /> {row.sim_serial || "—"}
         </div>
      )
    },
    {
      key: "phone_number",
      header: "Phone Number",
      render: (row) => (
         <span className="text-sm font-medium">{row.phone_number || "—"}</span>
      )
    },
    {
      key: "country_iso",
      header: "Country",
      render: (row) => (
         <div className="flex items-center gap-1.5 text-slate-500 text-xs">
           <Globe className="h-3.5 w-3.5" /> {row.country_iso ? row.country_iso.toUpperCase() : "—"}
         </div>
      )
    },
    {
      key: "timestamp",
      header: "Date / Time",
      render: (row) => (
        <div className="flex flex-col text-xs text-slate-500 whitespace-nowrap">
           <span className="font-semibold text-slate-700 dark:text-slate-300">
             {isValid(parseISO(row.timestamp)) ? format(parseISO(row.timestamp), "MMM d, yyyy h:mm a") : "—"}
           </span>
           <span>
             {isValid(parseISO(row.timestamp)) ? formatDistanceToNow(parseISO(row.timestamp), { addSuffix: true }) : ""}
           </span>
        </div>
      )
    }
  ]

  // ── Render ───────────────────────────────────────────────────
  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📲 SIM Card Changes" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Smartphone className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device from the sidebar to view its SIM card activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      <PageHeader 
        title="📲 SIM Card Changes" 
        description="Track SIM card insertions, removals, and changes on this device."
        actions={
          <Button variant="outline" size="sm" onClick={fetchData} disabled={isLoading} className="bg-white dark:bg-slate-900 shadow-sm">
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      {/* ── Warning Banner ── */}
      {recentChange && (
         <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 flex items-start sm:items-center gap-4 text-rose-800 dark:text-rose-300 shadow-sm animate-in slide-in-from-top-4">
            <div className="bg-rose-100 dark:bg-rose-900 h-10 w-10 shrink-0 rounded-full flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
            </div>
            <div className="flex-1 min-w-0">
               <h4 className="font-bold text-sm">A SIM card change was recently detected!</h4>
               <p className="text-xs opacity-90 mt-0.5">
                 The SIM was <strong>{recentChange.event_type}</strong> {formatDistanceToNow(parseISO(recentChange.timestamp), { addSuffix: true })}. 
                 Operator: {recentChange.operator_name || 'Unknown'}.
               </p>
            </div>
         </div>
      )}

      {/* ── Current SIM Info ── */}
      <Card className="border overflow-hidden shadow-sm bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-950/20 dark:to-slate-950">
        <CardHeader className="pb-3 flex flex-row items-center justify-between border-b border-indigo-100 dark:border-indigo-900/30 bg-white/50 dark:bg-slate-950/50">
           <div>
             <CardTitle className="text-lg flex items-center gap-2">
               <Smartphone className="h-5 w-5 text-indigo-500" /> Current Dashboard Context SIM
             </CardTitle>
             <CardDescription className="opacity-80">The most recent SIM information cached by the tracker for this device.</CardDescription>
           </div>
           <Badge className="bg-indigo-500 hover:bg-indigo-600 shadow-sm text-xs font-bold px-3 py-1">Current SIM</Badge>
        </CardHeader>
        <CardContent className="p-6">
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-1">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wilder">Operator</span>
                 <p className="font-bold text-slate-900 dark:text-slate-100 text-base">{device?.sim_operator || "Unknown / No SIM"}</p>
              </div>
              <div className="space-y-1">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wilder">Phone Number</span>
                 <p className="font-bold text-slate-900 dark:text-slate-100 text-base font-mono">{device?.phone_number || "—"}</p>
              </div>
              <div className="space-y-1">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wilder">ICCID / Serial</span>
                 <p className="font-medium text-slate-700 dark:text-slate-300 text-sm font-mono truncate max-w-[200px]" title={device?.sim_serial || ""} >
                   {device?.sim_serial || "—"}
                 </p>
              </div>
              <div className="space-y-1">
                 <span className="text-xs font-semibold text-slate-500 uppercase tracking-wilder">Device Identity</span>
                 <p className="font-medium text-slate-700 dark:text-slate-300 text-sm truncate max-w-[200px]" title={device?.device_model || ""}>
                   {device?.device_model || "—"}
                 </p>
              </div>
           </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
         {/* ── SIM Timeline (Left Column) ── */}
         <Card className="xl:col-span-1 border shadow-sm flex flex-col h-[500px]">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
               <CardTitle className="text-base flex items-center gap-2"><Calendar className="h-4 w-4 text-indigo-500" /> Event Timeline</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-auto">
               {simChanges.length === 0 && !isLoading ? (
                 <div className="p-8 text-center flex flex-col items-center">
                    <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-3 opacity-60" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">No SIM changes detected</p>
                    <p className="text-xs text-slate-400 max-w-[200px]">This device has been using the same SIM card since installation.</p>
                 </div>
               ) : (
                 <div className="p-6 relative">
                    {/* Connecting line */}
                    <div className="absolute left-[38px] top-6 bottom-6 w-0.5 bg-slate-200 dark:bg-slate-800 rounded-full" />
                    
                    <div className="space-y-6 relative">
                       {simChanges.map((change, i) => {
                         const c = EVENT_CONFIG[change.event_type] || EVENT_CONFIG.changed
                         const Icon = c.icon
                         return (
                           <div key={change.id} className="flex gap-4 group">
                              <div className={cn(
                                "relative z-10 w-8 h-8 rounded-full flex items-center justify-center shrink-0 border-4 border-white dark:border-slate-950 transition-transform group-hover:scale-110",
                                c.bg, c.text
                              )}>
                                <Icon className="h-3.5 w-3.5" />
                              </div>
                              <div className="flex flex-col pt-1">
                                <span className={cn("text-sm font-bold", c.text)}>{c.label} SIM</span>
                                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{change.operator_name || "Unknown Operator"}</span>
                                <span className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                  <Calendar className="h-3 w-3" />
                                  {isValid(parseISO(change.timestamp)) ? format(parseISO(change.timestamp), "MMM d, h:mm a") : ""}
                                </span>
                              </div>
                           </div>
                         )
                       })}
                    </div>
                 </div>
               )}
            </CardContent>
         </Card>

         {/* ── Data Table (Right Column) ── */}
         <Card className="xl:col-span-2 border shadow-sm flex flex-col min-h-[500px]">
            <CardHeader className="pb-0 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
               <CardTitle className="text-base pb-3">Change History Details</CardTitle>
            </CardHeader>
            <DataTable<SimChange>
               data={simChanges}
               columns={columns}
               isLoading={isLoading}
               searchable={true}
               searchPlaceholder="Search operator, serial, or number..."
               totalCount={simChanges.length}
            />
         </Card>
      </div>

    </div>
  )
}

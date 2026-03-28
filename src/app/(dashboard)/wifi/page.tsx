"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Wifi, Search, Map as MapIcon, Signal, SignalHigh, SignalMedium, SignalLow, AlertCircle, CheckCircle2, XCircle } from "lucide-react"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { MapWrapper } from "@/components/maps/map-wrapper"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { WifiNetwork, Location } from "@/lib/types/database"

export default function WifiNetworksPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [data, setData] = useState<WifiNetwork[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [connectedOnly, setConnectedOnly] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from("wifi_networks")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .limit(1000)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())
    if (connectedOnly) query = query.eq("is_connected", true)

    const { data: result, error } = await query
    
    if (result && !error) {
       setData(result as WifiNetwork[])
    } else {
       setData([])
    }
    
    setIsLoading(false)
  }, [selectedDeviceId, dateRange, connectedOnly])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const q = searchQuery.toLowerCase()
    return data.filter(d => 
      (d.ssid && d.ssid.toLowerCase().includes(q)) || 
      (d.bssid && d.bssid.toLowerCase().includes(q))
    )
  }, [data, searchQuery])

  // Prepare map locations from wifi data
  const mapLocations = useMemo(() => {
    return filteredData
      .filter(w => w.latitude !== null && w.longitude !== null)
      .map(w => ({
        id: w.id,
        latitude: w.latitude as number,
        longitude: w.longitude as number,
        timestamp: w.timestamp,
        accuracy: null, // wifi doesn't have accuracy typically, or simulate
        speed: w.signal_strength, // mapping signal strength to speed for map cluster data visually if needed, but not actually 'speed'
        battery_level: null,
        provider: 'wifi',
        is_mock: false,
        address: `${w.ssid} (${w.is_connected ? 'Connected' : 'Scanned'}) - ${w.signal_strength}dBm`,
        device_id: w.device_id,
        created_at: w.created_at,
        altitude: null,
        bearing: null
      } as Location))
  }, [filteredData])

  // Columns for DataTable
  const columns: ColumnDef<WifiNetwork>[] = [
    {
      key: "ssid",
      header: "SSID & Network Name",
      width: "250px",
      render: (row) => (
        <div className="flex flex-col">
          <span className={`text-sm ${row.is_connected ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
            {row.ssid || "Unknown Network"}
          </span>
          {row.security_type && (
            <span className="text-xs text-slate-500 uppercase tracking-wider">{row.security_type}</span>
          )}
        </div>
      )
    },
    {
      key: "bssid",
      header: "BSSID (Mac)",
      width: "160px",
      render: (row) => (
        <span className="text-xs font-mono text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">
          {row.bssid || "—"}
        </span>
      )
    },
    {
      key: "signal",
      header: "Signal",
      width: "100px",
      render: (row) => {
        const s = row.signal_strength || -100
        let Icon = SignalLow
        let colorClass = "text-rose-500"
        
        if (s >= -60) { Icon = Signal; colorClass = "text-emerald-500" }
        else if (s >= -75) { Icon = SignalHigh; colorClass = "text-amber-500" }
        else if (s >= -85) { Icon = SignalMedium; colorClass = "text-orange-500" }

        return (
          <div className="flex items-center gap-1.5" title={`${s} dBm`}>
            <Icon className={`h-4 w-4 ${colorClass}`} />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{s}dBm</span>
          </div>
        )
      }
    },
    {
      key: "status",
      header: "Status",
      width: "140px",
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.is_connected ? (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs font-medium border border-emerald-200 dark:border-emerald-800/50">
               <CheckCircle2 className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 text-xs font-medium border border-slate-200 dark:border-slate-700">
               <XCircle className="h-3 w-3" /> Scanned
            </span>
          )}
        </div>
      )
    },
    {
      key: "ip_address",
      header: "IP Address",
      width: "140px",
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-400">
          {row.ip_address || "—"}
        </span>
      )
    },
    {
      key: "timestamp",
      header: "Date / Time",
      width: "150px",
      render: (row) => {
        const d = parseISO(row.timestamp)
        return isValid(d) ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{format(d, "MMM d, yyyy")}</span>
            <span className="text-xs text-slate-500">{format(d, "h:mm a")}</span>
          </div>
        ) : <span>—</span>
      }
    }
  ]

  const exportColumns = [
    { key: "timestamp", header: "Date" },
    { key: "ssid", header: "SSID" },
    { key: "bssid", header: "BSSID" },
    { key: "security_type", header: "Security" },
    { key: "signal_strength", header: "Signal (dBm)" },
    { key: "is_connected", header: "Connected" },
    { key: "ip_address", header: "IP Address" },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📶 Wi-Fi Networks" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view Wi-Fi connection history and nearby networks.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="📶 Wi-Fi Networks"
          description="View Wi-Fi connections and nearby scanned networks."
        />
        <div className="flex items-center gap-2">
          <ExportButton data={filteredData} columns={exportColumns} filename="wifi_networks" />
        </div>
      </div>

      <Tabs defaultValue="history">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4 bg-white dark:bg-slate-950 p-2 sm:p-1 rounded-lg border shadow-sm">
          <TabsList className="h-10 sm:h-9 bg-transparent sm:bg-slate-100 sm:dark:bg-slate-800 self-stretch sm:self-auto flex justify-start overflow-x-auto border-b sm:border-0 border-slate-200 dark:border-slate-800 rounded-none sm:rounded-md pb-1 sm:pb-0 mb-2 sm:mb-0">
            <TabsTrigger value="history" className="text-xs sm:text-sm gap-1.5 focus:outline-none">
              <Wifi className="h-3.5 w-3.5" /> Connection History
            </TabsTrigger>
            <TabsTrigger value="map" className="text-xs sm:text-sm gap-1.5 focus:outline-none">
              <MapIcon className="h-3.5 w-3.5" /> Map View
            </TabsTrigger>
          </TabsList>
          
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 px-2 sm:px-3 self-stretch sm:self-auto">
            <div className="flex items-center space-x-2">
              <Switch 
                id="connected-only" 
                checked={connectedOnly} 
                onCheckedChange={setConnectedOnly} 
              />
              <Label htmlFor="connected-only" className="text-xs sm:text-sm font-medium cursor-pointer">
                Connected Only
              </Label>
            </div>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-800 hidden sm:block"></div>
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
          </div>
        </div>

        {/* Tab 1: Table */}
        <TabsContent value="history" className="mt-0 space-y-4">
          <Card className="overflow-hidden border shadow-sm">
            <DataTable<WifiNetwork>
              data={filteredData}
              columns={columns}
              isLoading={isLoading}
              searchable={true}
              searchPlaceholder="Search SSID or BSSID..."
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              emptyMessage={connectedOnly ? "No connected Wi-Fi networks found." : "No Wi-Fi data found."}
              emptyIcon={<Wifi className="h-10 w-10 mb-2 opacity-20" />}
            />
          </Card>
        </TabsContent>

        {/* Tab 2: Map */}
        <TabsContent value="map" className="mt-0">
          <Card className="h-[calc(100vh-250px)] min-h-[500px] border shadow-sm overflow-hidden relative">
             <MapWrapper 
                locations={mapLocations}
                showPath={false}
             />
             
             {mapLocations.length === 0 && !isLoading && (
               <div className="absolute inset-0 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm flex flex-col items-center justify-center z-[400]">
                 <MapIcon className="h-12 w-12 text-slate-400 mb-3 opacity-50" />
                 <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300">No Location Data</h3>
                 <p className="text-sm text-slate-500 max-w-sm text-center mt-1">
                   None of the Wi-Fi logs in this period have associated GPS coordinates.
                 </p>
               </div>
             )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

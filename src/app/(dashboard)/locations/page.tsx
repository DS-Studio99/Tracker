"use client"

import { useEffect, useState, useMemo } from "react"
import { format } from "date-fns"
import { 
  MapPin, 
  Map, 
  History, 
  Radio,
  AlertCircle,
  Crosshair,
  Wifi,
  Battery,
  ShieldAlert
} from "lucide-react"
import { DateRange } from "react-day-picker"

import { createClient } from "@/lib/supabase/client"
import { useDeviceStore } from "@/lib/stores/device-store"
import { useDeviceData } from "@/lib/hooks/use-device-data"
import { Location, DeviceSettings } from "@/lib/types/database"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { MapWrapper, GeofenceZone } from "@/components/maps/map-wrapper"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export default function LocationsPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  
  const [page, setPage] = useState(0)
  const pageSize = 50
  
  const [autoFollow, setAutoFollow] = useState(true)
  const [liveLocations, setLiveLocations] = useState<Location[]>([])
  const [geofences, setGeofences] = useState<GeofenceZone[]>([])

  // 1. History view data (paginated)
  const { data: historyData, count: historyCount, isLoading: historyLoading } = useDeviceData<Location>('locations', {
    pageSize,
    orderBy: 'timestamp',
    orderDirection: 'desc',
    dateColumn: 'timestamp',
    dateRange,
    searchQuery,
    searchColumns: ['address', 'provider']
  })

  // 2. Map view data (fetch all for the selected date range)
  const [mapLocations, setMapLocations] = useState<Location[]>([])
  const [isMapLoading, setIsMapLoading] = useState(false)

  useEffect(() => {
    async function fetchMapLocations() {
      if (!selectedDeviceId) return
      setIsMapLoading(true)
      
      try {
        const supabase = createClient()
        let query = supabase
          .from('locations')
          .select('*')
          .eq('device_id', selectedDeviceId)
          .order('timestamp', { ascending: false })
          .limit(500) // limit to avoid crashing the browser with too many points
          
        if (dateRange?.from) {
          query = query.gte('timestamp', dateRange.from.toISOString())
        } else {
          // Default to today if no date range
          const startOfToday = new Date()
          startOfToday.setHours(0,0,0,0)
          query = query.gte('timestamp', startOfToday.toISOString())
        }
        
        if (dateRange?.to) {
          query = query.lte('timestamp', dateRange.to.toISOString())
        }

        const { data, error } = await query
        if (data) {
          setMapLocations(data)
        }
      } catch (e) {
        console.error("Failed to fetch map locations", e)
      } finally {
        setIsMapLoading(false)
      }
    }
    
    fetchMapLocations()
  }, [selectedDeviceId, dateRange])

  // 3. Live Tracking setup (real-time subscriptions + latest points)
  useEffect(() => {
    if (!selectedDeviceId) return

    const supabase = createClient()
    
    // Fetch initial latest points for context
    const fetchLatest = async () => {
      const { data } = await supabase
        .from('locations')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .order('timestamp', { ascending: false })
        .limit(20) // Show last 20 points for context
      
      if (data) {
        setLiveLocations(data)
      }
    }
    
    // Fetch geofences
    const fetchGeofences = async () => {
      const { data } = await supabase
        .from('device_settings')
        .select('geofence_zones')
        .eq('device_id', selectedDeviceId)
        .single()
        
      if ((data as any)?.geofence_zones) {
        setGeofences((data as any).geofence_zones as any)
      }
    }

    fetchLatest()
    fetchGeofences()

    // Subscribe to new locations
    const channel = supabase.channel(`live_locations_${selectedDeviceId}`)
      .on(
        'postgres_changes',
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'locations',
          filter: `device_id=eq.${selectedDeviceId}`
        },
        (payload) => {
          const newLoc = payload.new as Location
          setLiveLocations(prev => [newLoc, ...prev].slice(0, 100)) // Keep last 100
        }
      )
      .subscribe()
      
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDeviceId])

  const columns: ColumnDef<Location>[] = [
    {
      key: "index",
      header: "#",
      width: "50px",
      render: (row, i) => <span className="text-slate-500 text-xs">{(page * pageSize) + (i ?? 0) + 1}</span>
    },
    {
      key: "timestamp",
      header: "Date/Time",
      width: "160px",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{format(new Date(row.timestamp), "MMM d, yyyy")}</span>
          <span className="text-xs text-slate-500">{format(new Date(row.timestamp), "h:mm:ss a")}</span>
        </div>
      )
    },
    {
      key: "address",
      header: "Address",
      render: (row) => (
        <div className="flex items-start gap-2 max-w-[300px]">
          <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
          <span className="text-sm truncate" title={row.address || 'Unknown'}>{row.address || 'Coordinates only'}</span>
        </div>
      )
    },
    {
      key: "coordinates",
      header: "Lat / Lng",
      render: (row) => (
        <span className="text-xs font-mono text-slate-600">
          {row.latitude.toFixed(5)}, {row.longitude.toFixed(5)}
        </span>
      )
    },
    {
      key: "accuracy",
      header: "Accuracy",
      width: "100px",
      render: (row) => (
        <span className="text-sm flex items-center gap-1">
          <Crosshair className="h-3 w-3 text-slate-400" />
          {row.accuracy ? `±${Math.round(row.accuracy)}m` : '--'}
        </span>
      )
    },
    {
      key: "speed",
      header: "Speed",
      width: "100px",
      render: (row) => (
        <span className="text-sm">
          {row.speed ? `${Math.round(row.speed * 3.6)} km/h` : '--'}
        </span>
      )
    },
    {
      key: "details",
      header: "Info",
      render: (row) => (
        <div className="flex items-center gap-2">
          {row.battery_level !== null && (
            <Badge variant="outline" className="text-xs h-5 px-1.5 flex gap-1 font-normal">
              <Battery className="h-3 w-3" /> {row.battery_level}%
            </Badge>
          )}
          {row.provider && (
            <Badge variant="secondary" className="text-xs h-5 px-1.5 flex gap-1 font-normal capitalize">
              <Wifi className="h-3 w-3" /> {row.provider}
            </Badge>
          )}
          {row.is_mock && (
            <Badge variant="destructive" className="text-xs h-5 px-1.5 flex gap-1 font-normal">
              <ShieldAlert className="h-3 w-3" /> Mock
            </Badge>
          )}
        </div>
      )
    }
  ]

  const exportColumns = [
    { key: "timestamp", header: "Timestamp" },
    { key: "latitude", header: "Latitude" },
    { key: "longitude", header: "Longitude" },
    { key: "accuracy", header: "Accuracy (m)" },
    { key: "speed", header: "Speed (m/s)" },
    { key: "provider", header: "Provider" },
    { key: "address", header: "Address" },
    { key: "battery_level", header: "Battery %" },
    { key: "is_mock", header: "Is Mock" }
  ]

  if (!selectedDeviceId) {
    return (
       <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="GPS Locations" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">
            Please go to the dashboard or devices page and select a device to view location data.
          </p>
        </Card>
      </div>
    )
  }

  const latestLiveLoc = liveLocations[0]
  const liveCenter: [number, number] | undefined = latestLiveLoc && autoFollow 
    ? [latestLiveLoc.latitude, latestLiveLoc.longitude] 
    : undefined
    
  let secondsSinceUpdate = 0
  if (latestLiveLoc) {
    const timeDiff = new Date().getTime() - new Date(latestLiveLoc.timestamp).getTime()
    secondsSinceUpdate = Math.floor(timeDiff / 1000)
  }

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in h-full flex flex-col">
      <PageHeader 
        title="GPS Locations" 
        description="Track device location in real-time and view history"
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={historyData} columns={exportColumns} filename={`LocationsExport_${format(new Date(), 'yyyy-MM-dd')}`} />
          </div>
        }
      />

      <Tabs defaultValue="map" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3 max-w-md mx-auto mb-6">
          <TabsTrigger value="map" className="flex items-center gap-2">
            <Map className="h-4 w-4" /> Map View
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" /> History
          </TabsTrigger>
          <TabsTrigger value="live" className="flex items-center gap-2 text-emerald-600 data-[state=active]:text-emerald-700">
            <Radio className="h-4 w-4" /> Live Tracking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="map" className="flex-1 mt-0">
          <Card className="p-4 border shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <DateRangeFilter date={dateRange} setDate={setDateRange} />
              <div className="text-sm text-slate-500">
                {isMapLoading ? "Loading map..." : `Showing ${mapLocations.length} locations`}
              </div>
            </div>
            
            <div className="w-full relative z-0" style={{ height: 'calc(100vh - 280px)', minHeight: '500px' }}>
              <MapWrapper 
                locations={mapLocations}
                showPath={true}
                geofences={geofences}
              />
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-0 space-y-4">
          <div className="flex items-center justify-between">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
          </div>
          
          <DataTable 
             data={historyData}
             columns={columns}
             searchable
             searchPlaceholder="Search address or provider..."
             onSearch={setSearchQuery}
             isLoading={historyLoading}
             page={page}
             pageSize={pageSize}
             totalCount={historyCount}
             onPageChange={setPage}
          />
        </TabsContent>

        <TabsContent value="live" className="flex-1 mt-0">
          <Card className="p-0 border shadow-sm overflow-hidden relative">
            <div className="absolute top-4 left-4 z-[9999] bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border w-72">
               <div className="flex items-center gap-2 border-b pb-2 mb-2">
                 <div className="relative flex h-3 w-3">
                   <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                   <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                 </div>
                 <h3 className="font-semibold text-sm">Live Status</h3>
                 <span className="text-xs text-slate-500 ml-auto">
                    {latestLiveLoc ? `${secondsSinceUpdate}s ago` : 'Waiting...'}
                 </span>
               </div>
               
               {latestLiveLoc ? (
                 <div className="space-y-2 text-xs">
                   <div className="flex justify-between">
                     <span className="text-slate-500">Speed</span>
                     <span className="font-medium">{latestLiveLoc.speed ? `${Math.round(latestLiveLoc.speed * 3.6)} km/h` : '0 km/h'}</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-500">Battery</span>
                     <span className="font-medium">{latestLiveLoc.battery_level}%</span>
                   </div>
                   <div className="flex justify-between">
                     <span className="text-slate-500">Accuracy</span>
                     <span className="font-medium">{latestLiveLoc.accuracy ? `±${Math.round(latestLiveLoc.accuracy)}m` : '--'}</span>
                   </div>
                   
                   <div className="pt-2 mt-2 border-t flex justify-between items-center">
                     <span className="text-slate-500">Auto-follow mode</span>
                     <Button 
                       variant={autoFollow ? "default" : "outline"} 
                       size="sm" 
                       className="h-6 text-[10px] px-2"
                       onClick={() => setAutoFollow(!autoFollow)}
                     >
                       {autoFollow ? 'Enabled' : 'Disabled'}
                     </Button>
                   </div>
                 </div>
               ) : (
                 <p className="text-slate-500 text-xs italic">Waiting for first location update...</p>
               )}
            </div>
            
            <div className="w-full relative z-0" style={{ height: 'calc(100vh - 240px)', minHeight: '500px' }}>
              <MapWrapper 
                locations={liveLocations}
                center={liveCenter}
                geofences={geofences}
                showPath={true}
                liveMode={true}
                latestLocationId={latestLiveLoc?.id}
                zoom={16}
              />
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

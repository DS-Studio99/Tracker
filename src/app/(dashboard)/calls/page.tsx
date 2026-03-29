"use client"

import { useEffect, useState, useMemo } from "react"
import { format, subDays, startOfDay, endOfDay } from "date-fns"
import { 
  PhoneCall, 
  PhoneIncoming, 
  PhoneOutgoing, 
  PhoneMissed, 
  PhoneOff,
  Mic,
  MapPin,
  Trash2,
  AlertCircle,
  PlayCircle
} from "lucide-react"
import { DateRange } from "react-day-picker"
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts"

import { createClient } from "@/lib/supabase/client"
import { useDeviceStore } from "@/lib/stores/device-store"
import { useDeviceData } from "@/lib/hooks/use-device-data"
import { CallLog } from "@/lib/types/database"
import { formatDuration } from "@/lib/utils/format"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { DetailSheet } from "@/components/shared/detail-sheet"
import { StatCard } from "@/components/shared/stat-card"
import { AudioPlayer } from "@/components/shared/audio-player"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface CallStats {
  total: number
  incoming: number
  outgoing: number
  missed: number
  totalDuration: number
  topContacts: { name: string; count: number }[]
  callsByType: { name: string; value: number; color: string }[]
  callsByDay: { date: string; calls: number }[]
}

const COLORS = {
  incoming: '#10b981', // emerald-500
  outgoing: '#3b82f6', // blue-500
  missed: '#ef4444',   // red-500
  rejected: '#f97316', // orange-500
  blocked: '#64748b'   // slate-500
}

export default function CallsPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [callType, setCallType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [page, setPage] = useState(0)
  const [recordingsPage, setRecordingsPage] = useState(0)
  const pageSize = 25
  
  const [selectedCall, setSelectedCall] = useState<CallLog | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [stats, setStats] = useState<CallStats | null>(null)
  const [isStatsLoading, setIsStatsLoading] = useState(true)
  const [statsUpdateTrigger, setStatsUpdateTrigger] = useState(0)

  // Setup filters for query
  const filters = useMemo(() => {
    const f: Record<string, any> = {}
    if (callType !== "all") {
      f.call_type = callType
    }
    return f
  }, [callType])

  const { data: logsData, count: logsCount, isLoading: logsLoading, refetch: refetchLogs } = useDeviceData<CallLog>('call_logs', {
    pageSize,
    orderBy: 'timestamp',
    orderDirection: 'desc',
    filters,
    dateColumn: 'timestamp',
    dateRange,
    searchQuery,
    searchColumns: ['contact_name', 'phone_number']
  })

  // Separate data hook for recordings
  const { data: recordingsData, count: recordingsCount, isLoading: recordingsLoading, page: recPage, setPage: setRecPage } = useDeviceData<CallLog>('call_logs', {
    pageSize: 10, // Adjust page size for list view
    orderBy: 'timestamp',
    orderDirection: 'desc',
    notNullColumn: 'recording_url',
    dateColumn: 'timestamp',
    dateRange,
    searchQuery,
    searchColumns: ['contact_name', 'phone_number']
  })

  useEffect(() => {
    setPage(0)
  }, [selectedDeviceId, filters, dateRange, searchQuery])

  // Realtime Subscriptions for Instant Sync
  useEffect(() => {
    if (!selectedDeviceId) return

    const supabase = createClient()
    const channel = supabase
      .channel('realtime_calls')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_logs',
          filter: `device_id=eq.${selectedDeviceId}`
        },
        (payload) => {
          // Instantly refresh the data and stats when a new call arrives
          refetchLogs()
          setStatsUpdateTrigger(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDeviceId, refetchLogs])

  // Fetch stats (independent of pagination and search)
  useEffect(() => {
    async function fetchStats() {
      if (!selectedDeviceId) return
      setIsStatsLoading(true)
      
      try {
        const supabase = createClient()
        
        let baseQuery = supabase
          .from('call_logs')
          .select('call_type, contact_name, phone_number, duration, timestamp', { count: 'exact' })
          .eq('device_id', selectedDeviceId)
        
        if (dateRange?.from) baseQuery = baseQuery.gte('timestamp', dateRange.from.toISOString())
        if (dateRange?.to) baseQuery = baseQuery.lte('timestamp', dateRange.to.toISOString())

        const { data, count } = (await baseQuery) as { data: CallLog[] | null, count: number | null }
        
        if (data) {
          let incoming = 0
          let outgoing = 0
          let missed = 0
          let rejected = 0
          let blocked = 0
          let totalDuration = 0
          const contacts: Record<string, number> = {}
          const daysRecord: Record<string, number> = {}

          data.forEach(call => {
            // Count by type
            if (call.call_type === 'incoming') incoming++
            else if (call.call_type === 'outgoing') outgoing++
            else if (call.call_type === 'missed') missed++
            else if (call.call_type === 'rejected') rejected++
            else if (call.call_type === 'blocked') blocked++

            // Sum duration
            totalDuration += (call.duration || 0)

            // Top contacts
            const contactKey = call.contact_name || call.phone_number
            if (contactKey) {
              contacts[contactKey] = (contacts[contactKey] || 0) + 1
            }

            // Calls per day (last 7 days logic could be limited by UI, but we'll collect whatever matches the dateRange)
            // If dateRange is huge, this object gets big. We can take last 7 available days.
            const dayKey = format(new Date(call.timestamp), 'MMM dd')
            daysRecord[dayKey] = (daysRecord[dayKey] || 0) + 1
          })

          const callsByType = [
            { name: 'Incoming', value: incoming, color: COLORS.incoming },
            { name: 'Outgoing', value: outgoing, color: COLORS.outgoing },
            { name: 'Missed', value: missed, color: COLORS.missed },
            { name: 'Rejected', value: rejected, color: COLORS.rejected },
            { name: 'Blocked', value: blocked, color: COLORS.blocked }
          ].filter(i => i.value > 0)

          const topContacts = Object.entries(contacts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }))

          // Create a last 7 days array based on the end of the selected range or today
          const endObj = dateRange?.to ? new Date(dateRange.to) : new Date()
          const callsByDay = []
          for (let i = 6; i >= 0; i--) {
            const d = subDays(endObj, i)
            const key = format(d, 'MMM dd')
            callsByDay.push({
              date: key,
              calls: daysRecord[key] || 0
            })
          }

          setStats({
            total: count || 0,
            incoming,
            outgoing,
            missed,
            totalDuration,
            topContacts,
            callsByType,
            callsByDay
          })
        }
      } catch (e) {
        console.error("Failed to fetch call stats", e)
      } finally {
        setIsStatsLoading(false)
      }
    }
    
    fetchStats()
  }, [selectedDeviceId, dateRange, statsUpdateTrigger])

  const typeIcon = (type: string) => {
    switch (type) {
      case 'incoming': return <PhoneIncoming className="h-4 w-4 text-emerald-500" />
      case 'outgoing': return <PhoneOutgoing className="h-4 w-4 text-blue-500" />
      case 'missed': return <PhoneMissed className="h-4 w-4 text-red-500" />
      case 'rejected': return <PhoneOff className="h-4 w-4 text-orange-500" />
      case 'blocked': return <PhoneOff className="h-4 w-4 text-slate-500" />
      default: return <PhoneCall className="h-4 w-4 text-slate-400" />
    }
  }

  const columns: ColumnDef<CallLog>[] = [
    {
      key: "call_type",
      header: "Type",
      width: "60px",
      render: (row) => (
        <div className="flex justify-center" title={row.call_type}>
          {typeIcon(row.call_type)}
        </div>
      )
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-slate-900 dark:text-slate-100">{row.contact_name || 'Unknown'}</span>
          <span className="text-xs text-slate-500">{row.phone_number}</span>
        </div>
      )
    },
    {
      key: "duration",
      header: "Duration",
      render: (row) => (
        <span className="text-sm">
          {row.call_type === 'missed' || row.call_type === 'rejected' || row.call_type === 'blocked' ? 
            <span className="text-slate-300">—</span> : 
            formatDuration(row.duration)
          }
        </span>
      )
    },
    {
      key: "recording",
      header: "Rec",
      width: "60px",
      render: (row) => (
        <div className="flex justify-center">
          {row.recording_url ? (
            <div className="bg-emerald-100 dark:bg-emerald-900/40 p-1.5 rounded-full text-emerald-600 dark:text-emerald-400">
              <Mic className="h-3.5 w-3.5" />
            </div>
          ) : <span className="text-slate-200 dark:text-slate-800">—</span>}
        </div>
      )
    },
    {
      key: "timestamp",
      header: "Date/Time",
      width: "160px",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{format(new Date(row.timestamp), "MMM d, yyyy")}</span>
          <span className="text-xs text-slate-500">{format(new Date(row.timestamp), "h:mm a")}</span>
        </div>
      )
    }
  ]

  const exportColumns = [
    { key: "call_type", header: "Type" },
    { key: "contact_name", header: "Contact Name" },
    { key: "phone_number", header: "Phone Number" },
    { key: "duration", header: "Duration (s)" },
    { key: "timestamp", header: "Timestamp" }
  ]

  const handleBlockNumber = async (number: string) => {
    try {
      if (!selectedDeviceId) return;
      const supabase = createClient()
      
      const { error } = await supabase.from('remote_commands').insert({
        device_id: selectedDeviceId,
        command_type: 'block_number',
        parameters: { phone_number: number },
        status: 'pending'
      } as any)
      
      if (error) throw error
      toast.success(`Command sent to block number: ${number}`)
    } catch (e) {
      toast.error("Failed to send block command")
      console.error(e)
    }
  }

  if (!selectedDeviceId) {
    return (
       <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="Calls" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">
            Please go to the dashboard or devices page and select a device to view its call logs.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in">
      <PageHeader 
        title="Calls" 
        description="View call logs and listen to call recordings"
        actions={
           <div className="flex items-center gap-2">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
            <ExportButton data={logsData} columns={exportColumns} filename={`Calls_Export_${format(new Date(), 'yyyy-MM-dd')}`} />
          </div>
        }
      />

      <Tabs defaultValue="logs" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:w-[400px]">
          <TabsTrigger value="logs">Call Logs</TabsTrigger>
          <TabsTrigger value="recordings">Call Recordings</TabsTrigger>
        </TabsList>

        <div className="space-y-6">
          {/* Stats Section - Visible on both tabs, collapsible visually implied but implemented as cards + charts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
             {isStatsLoading ? (
               Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-[100px] rounded-xl" />)
             ) : (
               <>
                 <StatCard 
                    title="Total Calls" 
                    value={stats?.total || 0} 
                    icon={<PhoneCall className="h-4 w-4" />} 
                    color="bg-slate-100 text-slate-600 dark:bg-slate-800"
                  />
                  <StatCard 
                    title="Incoming" 
                    value={stats?.incoming || 0} 
                    icon={<PhoneIncoming className="h-4 w-4" />} 
                    color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40"
                  />
                  <StatCard 
                    title="Outgoing" 
                    value={stats?.outgoing || 0} 
                    icon={<PhoneOutgoing className="h-4 w-4" />} 
                    color="bg-blue-100 text-blue-600 dark:bg-blue-900/40"
                  />
                  <StatCard 
                    title="Missed" 
                    value={stats?.missed || 0} 
                    icon={<PhoneMissed className="h-4 w-4" />} 
                    color="bg-red-100 text-red-600 dark:bg-red-900/40"
                  />
                  <StatCard 
                    title="Total Dur." 
                    value={formatDuration(stats?.totalDuration || 0)} 
                    icon={<PlayCircle className="h-4 w-4" />} 
                    color="bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40"
                  />
               </>
             )}
          </div>

          {/* Charts Row */}
          {!isStatsLoading && stats && stats.total > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
               <Card>
                 <CardHeader className="py-4">
                   <CardTitle className="text-sm">Calls By Type</CardTitle>
                 </CardHeader>
                 <CardContent className="h-[200px] flex items-center justify-center">
                   {stats.callsByType.length > 0 ? (
                     <ResponsiveContainer width="100%" height="100%">
                         <PieChart>
                            <Pie
                              data={stats.callsByType}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={2}
                              dataKey="value"
                            >
                               {stats.callsByType.map((entry, index) => (
                                 <Cell key={`cell-${index}`} fill={entry.color} />
                               ))}
                            </Pie>
                            <RechartsTooltip 
                               formatter={(value) => [`${value} calls`, 'Count']}
                               contentStyle={{ borderRadius: '8px' }}
                            />
                         </PieChart>
                     </ResponsiveContainer>
                   ) : (
                     <div className="text-slate-400 text-sm">No data</div>
                   )}
                 </CardContent>
               </Card>

               <Card className="md:col-span-1">
                  <CardHeader className="py-4">
                    <CardTitle className="text-sm">Top Contacts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                       {stats.topContacts.length > 0 ? (
                         stats.topContacts.map((contact, i) => (
                           <div key={i} className="flex justify-between items-center text-sm">
                             <span className="font-medium truncate mr-2">{contact.name}</span>
                             <Badge variant="secondary">{contact.count}</Badge>
                           </div>
                         ))
                       ) : (
                         <div className="text-slate-400 text-sm text-center py-4">No top contacts yet</div>
                       )}
                    </div>
                  </CardContent>
               </Card>

               <Card className="md:col-span-1">
                 <CardHeader className="py-4">
                   <CardTitle className="text-sm">Last 7 Days (Calls)</CardTitle>
                 </CardHeader>
                 <CardContent className="h-[180px]">
                     <ResponsiveContainer width="100%" height="100%">
                       <BarChart data={stats.callsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                         <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                         <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                         <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px' }}/>
                         <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} />
                       </BarChart>
                     </ResponsiveContainer>
                 </CardContent>
               </Card>
            </div>
          )}
        </div>

        <TabsContent value="logs" className="space-y-4 outline-none">
          {/* Filters */}
          <Card className="p-4 flex flex-col md:flex-row items-center gap-4 border-slate-200">
            <div className="w-full md:w-[200px]">
              <Select value={callType} onValueChange={(val) => val && setCallType(val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Call Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Calls</SelectItem>
                  <SelectItem value="incoming">Incoming</SelectItem>
                  <SelectItem value="outgoing">Outgoing</SelectItem>
                  <SelectItem value="missed">Missed</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          <DataTable
            columns={columns}
            data={logsData}
            isLoading={logsLoading}
            totalCount={logsCount}
            page={page}
            pageSize={pageSize}
            onPageChange={setPage}
            searchable
            searchPlaceholder="Search calls or numbers..."
            onSearch={setSearchQuery}
            emptyMessage="No call logs found"
            emptyIcon={<PhoneCall className="h-10 w-10 text-slate-300" />}
            onRowClick={(row) => {
              setSelectedCall(row)
              setIsSheetOpen(true)
            }}
          />
        </TabsContent>

        <TabsContent value="recordings" className="space-y-4 outline-none">
          <Card className="p-0 border-slate-200 overflow-hidden">
             <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                   <Mic className="h-5 w-5 text-emerald-500" /> 
                   Call Recordings
                </h3>
                <Input 
                   placeholder="Search contact or number..." 
                   className="max-w-xs bg-white dark:bg-slate-950" 
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
             
             <div className="p-0">
                {recordingsLoading ? (
                  <div className="p-4 space-y-4">
                     {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
                  </div>
                ) : recordingsData.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                     {recordingsData.map((rec) => (
                       <div key={rec.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-start gap-3 flex-1">
                             <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full shrink-0">
                                {typeIcon(rec.call_type)}
                             </div>
                             <div>
                                <p className="font-medium text-slate-900 dark:text-slate-100">{rec.contact_name || rec.phone_number}</p>
                                <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 flex-wrap">
                                   <span>{format(new Date(rec.timestamp), "MMM d, yyyy h:mm a")}</span>
                                   •
                                   <span>Duration: {formatDuration(rec.duration)}</span>
                                   •
                                   <Badge variant="outline" className="text-[10px] capitalize px-1 py-0">{rec.call_type}</Badge>
                                </div>
                             </div>
                          </div>
                          <div className="shrink-0 max-w-sm w-full md:w-auto">
                             {rec.recording_url ? (
                               <AudioPlayer src={rec.recording_url} title={rec.contact_name || rec.phone_number} duration={rec.recording_duration || rec.duration} />
                             ) : (
                               <div className="text-sm text-slate-500 italic">Audio unavailable</div>
                             )}
                          </div>
                       </div>
                     ))}
                  </div>
                ) : (
                   <div className="flex flex-col items-center justify-center p-12 text-slate-500">
                      <Mic className="h-12 w-12 text-slate-300 mb-4" />
                      <p>No recordings found</p>
                   </div>
                )}
             </div>
             
             {/* Simple paginator for recordings view */}
             {recordingsCount > 10 && (
                <div className="p-4 border-t flex justify-end gap-2">
                   <Button variant="outline" size="sm" onClick={() => setRecordingsPage(Math.max(0, recordingsPage - 1))} disabled={recordingsPage === 0}>Previous</Button>
                   <Button variant="outline" size="sm" onClick={() => setRecordingsPage(recordingsPage + 1)} disabled={(recordingsPage + 1) * 10 >= recordingsCount}>Next</Button>
                </div>
             )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Row Detail Sheet */}
      <DetailSheet 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)}
        title="Call Details"
      >
        {selectedCall && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex gap-2 items-center">
                {typeIcon(selectedCall.call_type)}
                <span className="font-semibold text-lg capitalize">{selectedCall.call_type} Call</span>
              </div>
              {selectedCall.is_deleted && (
                 <Badge variant="destructive" className="flex items-center gap-1">
                   <Trash2 className="h-3 w-3" /> Deleted
                 </Badge>
              )}
            </div>
            
            <Card className="p-4 bg-slate-50 dark:bg-slate-900/50">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Contact Name</Label>
                  <p className="font-medium mt-1">
                    {selectedCall.contact_name || 'Unknown'}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Number</Label>
                  <p className="font-medium mt-1 font-mono">
                    {selectedCall.phone_number}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Date & Time</Label>
                  <p className="font-medium mt-1">{format(new Date(selectedCall.timestamp), "PPP p")}</p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Duration</Label>
                  <p className="font-medium mt-1">{formatDuration(selectedCall.duration)}</p>
                </div>
              </div>
            </Card>

            {selectedCall.recording_url && (
              <div className="space-y-3">
                <Label className="text-slate-800 dark:text-slate-200 font-semibold flex items-center gap-2">
                  <Mic className="h-4 w-4 text-emerald-500" />
                  Conversation Recording
                </Label>
                <Card className="p-0 overflow-hidden border-emerald-100 dark:border-emerald-900/50">
                  <AudioPlayer 
                     src={selectedCall.recording_url} 
                     title={`Recording - ${selectedCall.contact_name || selectedCall.phone_number}`} 
                     duration={selectedCall.recording_duration || selectedCall.duration} 
                  />
                </Card>
              </div>
            )}

            {selectedCall.latitude && selectedCall.longitude && (
              <div className="space-y-2">
                <Label className="text-slate-500 text-xs uppercase tracking-wider">Location During Call</Label>
                <div className="border rounded-lg overflow-hidden h-[200px] relative bg-slate-100">
                   <iframe 
                      title="map"
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      src={`https://maps.google.com/maps?q=${selectedCall.latitude},${selectedCall.longitude}&hl=en&z=15&output=embed`}
                   />
                </div>
              </div>
            )}

            <div className="pt-4 border-t">
               <Button 
                  variant="destructive" 
                  className="w-full"
                  onClick={() => handleBlockNumber(selectedCall.phone_number)}
               >
                 <PhoneOff className="mr-2 h-4 w-4" />
                 Block this number
               </Button>
            </div>
          </div>
        )}
      </DetailSheet>
    </div>
  )
}

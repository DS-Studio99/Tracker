"use client"

import { useEffect, useState, useMemo } from "react"
import { format } from "date-fns"
import { 
  MessageSquare, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Pencil, 
  Image as ImageIcon,
  MapPin,
  Trash2,
  AlertCircle
} from "lucide-react"
import { DateRange } from "react-day-picker"

import { createClient } from "@/lib/supabase/client"
import { useDeviceStore } from "@/lib/stores/device-store"
import { useDeviceData } from "@/lib/hooks/use-device-data"
import { SmsMessage } from "@/lib/types/database"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { DetailSheet } from "@/components/shared/detail-sheet"
import { StatCard } from "@/components/shared/stat-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

interface SmsStats {
  total: number
  incoming: number
  outgoing: number
  topContact: string
}

export default function SmsPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [messageType, setMessageType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [mmsOnly, setMmsOnly] = useState(false)
  
  const [page, setPage] = useState(0)
  const pageSize = 25
  
  const [selectedMessage, setSelectedMessage] = useState<SmsMessage | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [stats, setStats] = useState<SmsStats | null>(null)
  const [statsUpdateTrigger, setStatsUpdateTrigger] = useState(0)

  // Setup filters for query
  const filters = useMemo(() => {
    const f: Record<string, any> = {}
    if (messageType !== "all") {
      f.message_type = messageType
    }
    if (mmsOnly) {
      f.is_mms = true
    }
    return f
  }, [messageType, mmsOnly])

  const { data, count, isLoading, refetch } = useDeviceData<SmsMessage>('sms_messages', {
    pageSize,
    orderBy: 'timestamp',
    orderDirection: 'desc',
    filters,
    dateColumn: 'timestamp',
    dateRange,
    searchQuery,
    searchColumns: ['body', 'sender_name', 'sender_number', 'receiver_name', 'receiver_number']
  })

  useEffect(() => {
    setPage(0)
  }, [selectedDeviceId, filters, dateRange, searchQuery])

  // Realtime Subscriptions for Instant Sync
  useEffect(() => {
    if (!selectedDeviceId) return

    const supabase = createClient()
    const channel = supabase
      .channel('realtime_sms')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_messages',
          filter: `device_id=eq.${selectedDeviceId}`
        },
        (payload) => {
          // Instantly refresh the data and stats when a new SMS arrives
          refetch()
          setStatsUpdateTrigger(prev => prev + 1)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedDeviceId, refetch])

  // Fetch stats (independent of pagination and search)
  useEffect(() => {
    async function fetchStats() {
      if (!selectedDeviceId) return
      
      const supabase = createClient()
      
      let baseQuery = supabase.from('sms_messages').select('message_type, sender_name, receiver_name', { count: 'exact' }).eq('device_id', selectedDeviceId)
      
      if (dateRange?.from) baseQuery = baseQuery.gte('timestamp', dateRange.from.toISOString())
      if (dateRange?.to) baseQuery = baseQuery.lte('timestamp', dateRange.to.toISOString())

      const { data, count } = await (baseQuery as any)
      
      if (data) {
        let incoming = 0
        let outgoing = 0
        let draft = 0
        const contacts: Record<string, number> = {}

        data.forEach((msg: any) => {
          if (msg.message_type === 'incoming') incoming++
          else if (msg.message_type === 'outgoing') outgoing++
          else draft++

          const contact = msg.message_type === 'incoming' ? msg.sender_name : msg.receiver_name
          if (contact) {
            contacts[contact] = (contacts[contact] || 0) + 1
          }
        })

        // Find top contact
        let topContact = "N/A"
        let maxCount = 0
        Object.entries(contacts).forEach(([name, c]) => {
          if (c > maxCount) {
            maxCount = c
            topContact = name
          }
        })

        setStats({
          total: count || 0,
          incoming,
          outgoing,
          topContact
        })
      }
    }
    
    fetchStats()
  }, [selectedDeviceId, dateRange, statsUpdateTrigger])

  const typeIcon = (type: string) => {
    switch (type) {
      case 'incoming': return <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
      case 'outgoing': return <ArrowUpRight className="h-4 w-4 text-blue-500" />
      default: return <Pencil className="h-4 w-4 text-slate-400" />
    }
  }

  const columns: ColumnDef<SmsMessage>[] = [
    {
      key: "message_type",
      header: "Type",
      width: "60px",
      render: (row) => (
        <div className="flex justify-center" title={row.message_type}>
          {typeIcon(row.message_type)}
        </div>
      )
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => {
        const name = row.message_type === 'incoming' ? row.sender_name : row.receiver_name
        const number = row.message_type === 'incoming' ? row.sender_number : row.receiver_number
        return (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-slate-100">{name || 'Unknown'}</span>
            <span className="text-xs text-slate-500">{number}</span>
          </div>
        )
      }
    },
    {
      key: "body",
      header: "Message",
      render: (row) => (
        <div className="flex items-center gap-2 max-w-[250px] sm:max-w-xs md:max-w-md">
          {row.is_mms && <Badge variant="secondary" className="h-5 px-1 shrink-0"><ImageIcon className="h-3 w-3 mr-1"/>MMS</Badge>}
          <span className="truncate text-sm">
            {row.body ? row.body : (row.is_mms ? 'Media Attachment' : 'Empty message')}
          </span>
        </div>
      )
    },
    {
      key: "location",
      header: "Location",
      width: "100px",
      render: (row) => (
        row.latitude && row.longitude ? (
          <a
            href={`https://maps.google.com/?q=${row.latitude},${row.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center text-xs text-blue-600 hover:text-blue-800 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <MapPin className="h-3 w-3 mr-1" /> View
          </a>
        ) : <span className="text-slate-300">-</span>
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
    { key: "message_type", header: "Type" },
    { key: "sender_name", header: "Sender Name" },
    { key: "sender_number", header: "Sender Number" },
    { key: "receiver_name", header: "Receiver Name" },
    { key: "receiver_number", header: "Receiver Number" },
    { key: "body", header: "Message Body" },
    { key: "timestamp", header: "Timestamp" }
  ]

  if (!selectedDeviceId) {
    return (
       <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="SMS / MMS Messages" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">
            Please go to the dashboard or devices page and select a device to view its text messages.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in">
      <PageHeader 
        title="SMS / MMS Messages" 
        description="View all text messages sent and received"
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
            <ExportButton data={data} columns={exportColumns} filename={`SMS_Export_${format(new Date(), 'yyyy-MM-dd')}`} />
          </div>
        }
      />

      {/* Stats Section */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard 
          title="Total Messages" 
          value={stats?.total || 0} 
          icon={<MessageSquare className="h-4 w-4" />} 
          color="bg-purple-100 text-purple-600 dark:bg-purple-900/40"
        />
        <StatCard 
          title="Incoming" 
          value={stats?.incoming || 0} 
          icon={<ArrowDownLeft className="h-4 w-4" />} 
          color="bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40"
        />
        <StatCard 
          title="Outgoing" 
          value={stats?.outgoing || 0} 
          icon={<ArrowUpRight className="h-4 w-4" />} 
          color="bg-blue-100 text-blue-600 dark:bg-blue-900/40"
        />
        <StatCard 
          title="Top Contact" 
          value={stats?.topContact || "N/A"} 
          icon={<MessageSquare className="h-4 w-4" />} 
        />
      </div>

      {/* Filters Bar */}
      <Card className="p-4 flex flex-col md:flex-row items-center gap-4 border-slate-200">
        <div className="w-full md:w-[200px]">
          <Select value={messageType} onValueChange={(v) => v && setMessageType(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Message Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Messages</SelectItem>
              <SelectItem value="incoming">Incoming Only</SelectItem>
              <SelectItem value="outgoing">Outgoing Only</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center space-x-2 shrink-0">
          <Switch id="mms-only" checked={mmsOnly} onCheckedChange={setMmsOnly} />
          <Label htmlFor="mms-only">MMS Only</Label>
        </div>
      </Card>

      <DataTable
        columns={columns}
        data={data}
        isLoading={isLoading}
        totalCount={count}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        searchable
        searchPlaceholder="Search messages or contacts..."
        onSearch={setSearchQuery}
        emptyMessage="No SMS messages found"
        emptyIcon={<MessageSquare className="h-10 w-10 text-slate-300" />}
        onRowClick={(row) => {
          setSelectedMessage(row)
          setIsSheetOpen(true)
        }}
      />

      <DetailSheet 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)}
        title="Message Details"
      >
        {selectedMessage && (
          <div className="space-y-6">
            <div className="flex justify-between items-start">
              <div className="flex gap-2 items-center">
                {typeIcon(selectedMessage.message_type)}
                <span className="font-semibold text-lg capitalize">{selectedMessage.message_type} Message</span>
              </div>
              {selectedMessage.is_deleted && (
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
                    {selectedMessage.message_type === 'incoming' 
                      ? (selectedMessage.sender_name || 'Unknown') 
                      : (selectedMessage.receiver_name || 'Unknown')}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Number</Label>
                  <p className="font-medium mt-1 font-mono">
                    {selectedMessage.message_type === 'incoming' 
                      ? selectedMessage.sender_number 
                      : selectedMessage.receiver_number}
                  </p>
                </div>
                <div>
                  <Label className="text-slate-500 text-xs uppercase tracking-wider">Date & Time</Label>
                  <p className="font-medium mt-1">{format(new Date(selectedMessage.timestamp), "PPP p")}</p>
                </div>
              </div>
            </Card>

            <div className="space-y-2">
              <Label className="text-slate-500 text-xs uppercase tracking-wider">Message Content</Label>
              <div className="p-4 bg-white dark:bg-slate-950 border rounded-lg whitespace-pre-wrap min-h-[100px]">
                {selectedMessage.body || <span className="text-slate-400 italic">No text content</span>}
              </div>
            </div>

            {selectedMessage.is_mms && selectedMessage.mms_attachment_url && (
              <div className="space-y-2">
                <Label className="text-slate-500 text-xs uppercase tracking-wider">Attachment</Label>
                <div className="border rounded-lg overflow-hidden flex items-center justify-center bg-slate-100 min-h-[200px]">
                  {/* Assuming image attachment, use a proper viewer if needed */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedMessage.mms_attachment_url} alt="MMS Attachment" className="max-w-full object-contain" onError={(e) => {
                      (e.target as any).style.display = 'none';
                    }}/>
                </div>
              </div>
            )}

            {selectedMessage.latitude && selectedMessage.longitude && (
              <div className="space-y-2">
                <Label className="text-slate-500 text-xs uppercase tracking-wider">Location Stamp</Label>
                <div className="border rounded-lg overflow-hidden h-[200px] relative bg-slate-100">
                   <iframe 
                      title="map"
                      width="100%" 
                      height="100%" 
                      frameBorder="0" 
                      src={`https://maps.google.com/maps?q=${selectedMessage.latitude},${selectedMessage.longitude}&hl=en&z=15&output=embed`}
                   />
                </div>
              </div>
            )}
          </div>
        )}
      </DetailSheet>
    </div>
  )
}

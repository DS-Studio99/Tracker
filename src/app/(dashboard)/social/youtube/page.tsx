"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Play, PlayCircle, AlertCircle, Bell, Video } from "lucide-react"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { SocialMessage } from "@/lib/types/database"

interface NotificationLog {
  id: string
  device_id: string
  title: string | null
  content: string | null
  timestamp: string
}

export default function YouTubePage() {
  const { selectedDeviceId } = useDeviceStore()
  
  // Videos
  const [videos, setVideos] = useState<SocialMessage[]>([])
  const [videoSearch, setVideoSearch] = useState("")
  const [videosLoading, setVideosLoading] = useState(false)
  
  // Notifications
  const [notifications, setNotifications] = useState<NotificationLog[]>([])
  const [notifSearch, setNotifSearch] = useState("")
  const [notifLoading, setNotifLoading] = useState(false)
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  // Fetch watched videos
  const fetchVideos = useCallback(async () => {
    if (!selectedDeviceId) return
    setVideosLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from("social_messages")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .eq("platform", "youtube")
      .order("timestamp", { ascending: false })
      .limit(50)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setVideos(data as SocialMessage[])
    setVideosLoading(false)
  }, [selectedDeviceId, dateRange])

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!selectedDeviceId) return
    setNotifLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from("notification_logs")
      .select("id, device_id, title, content, timestamp")
      .eq("device_id", selectedDeviceId)
      .eq("package_name", "com.google.android.youtube")
      .order("timestamp", { ascending: false })
      .limit(50)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setNotifications(data as NotificationLog[])
    setNotifLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { 
    fetchVideos()
    fetchNotifications()
  }, [fetchVideos, fetchNotifications])

  // Filter videos locally
  const filteredVideos = videoSearch.trim() 
    ? videos.filter(v => v.body?.toLowerCase().includes(videoSearch.toLowerCase())) 
    : videos

  // Notification Columns
  const notifColumns: ColumnDef<NotificationLog>[] = [
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
    },
    {
      key: "title",
      header: "Alert Title",
      render: (row) => <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{row.title || "—"}</span>
    },
    {
      key: "content",
      header: "Details",
      render: (row) => <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">{row.content || "—"}</span>
    },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="▶️ YouTube Activity" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view YouTube watch history and activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <Tabs defaultValue="history">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="h-9">
            <TabsTrigger value="history" className="text-xs gap-1.5 focus:outline-none">
              <PlayCircle className="h-3.5 w-3.5" /> Watch History
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5 focus:outline-none">
              <Bell className="h-3.5 w-3.5" /> Notifications & Activity
            </TabsTrigger>
          </TabsList>
          
          <DateRangeFilter date={dateRange} setDate={setDateRange} />
        </div>

        {/* Tab 1: Watched Grid */}
        <TabsContent value="history" className="mt-0 space-y-4">
          <PageHeader
            title="▶️ YouTube Watch History"
            description="Recently watched videos extracted from activity and notifications."
            actions={
              <Input
                placeholder="Search video title..."
                className="w-48 sm:w-64 h-9 text-sm"
                value={videoSearch}
                onChange={(e) => setVideoSearch(e.target.value)}
              />
            }
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {videosLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="overflow-hidden p-0 border flex flex-col">
                  <Skeleton className="aspect-video w-full rounded-b-none" />
                  <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </Card>
              ))
            ) : filteredVideos.length === 0 ? (
              <Card className="col-span-full py-20 flex flex-col items-center justify-center text-slate-400 border-dashed">
                <PlayCircle className="h-12 w-12 mb-3 opacity-30" />
                <p>No watched videos found matching criteria.</p>
              </Card>
            ) : (
              filteredVideos.map((item) => (
                <Card key={item.id} className="overflow-hidden p-0 hover:shadow-md transition-shadow group flex flex-col border">
                  <div className="aspect-video bg-slate-100 dark:bg-slate-800 w-full relative group-hover:opacity-90 overflow-hidden">
                    {item.media_thumbnail_url || item.media_url ? (
                      <img src={item.media_thumbnail_url || item.media_url || undefined} alt="Video Thumbnail" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="h-10 w-10 text-slate-300" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle className="text-white h-10 w-10 shadow-sm rounded-full" />
                    </div>
                  </div>
                  
                  <div className="p-3 flex flex-col flex-1">
                    <h4 className="font-semibold text-sm line-clamp-2 text-slate-800 dark:text-slate-100 leading-tight">
                      {item.body || item.message_type || "Watched Video"}
                    </h4>
                    
                    <div className="mt-auto pt-2 text-xs text-slate-500 flex justify-between items-center">
                       <span>{item.sender_name || item.group_name || "YouTube"}</span>
                       <span>
                         {isValid(parseISO(item.timestamp)) ? format(parseISO(item.timestamp), "MMM d") : ""}
                       </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Tab 2: Native Notifications */}
        <TabsContent value="activity" className="mt-0">
          <Card className="overflow-hidden border shadow-sm">
            <DataTable
              data={notifications}
              columns={notifColumns}
              isLoading={notifLoading}
              searchPlaceholder="Search notifications…"
              onSearch={setNotifSearch}
              searchQuery={notifSearch}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

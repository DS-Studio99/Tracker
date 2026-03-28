"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Bell, MessageCircle, AlertCircle } from "lucide-react"
import { DateRange } from "react-day-picker"

import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"

interface NotificationLog {
  id: string
  device_id: string
  app_name: string | null
  package_name: string | null
  title: string | null
  content: string | null
  big_text: string | null
  category: string | null
  timestamp: string
  created_at: string
}

const FACEBOOK_PACKAGES = [
  "com.facebook.katana",
  "com.facebook.orca",
  "com.facebook.mlite",
  "com.facebook.lite",
]

export default function FacebookPage() {
  const { selectedDeviceId } = useDeviceStore()
  const [activityData, setActivityData] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [page, setPage] = useState(0)
  const pageSize = 50

  const fetchActivity = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    let query = supabase
      .from("notification_logs")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .in("package_name", FACEBOOK_PACKAGES)
      .order("timestamp", { ascending: false })
      .range(page * pageSize, (page + 1) * pageSize - 1)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setActivityData(data as NotificationLog[])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange, page])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const activityColumns: ColumnDef<NotificationLog>[] = [
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
        ) : <span className="text-slate-400 text-xs">—</span>
      }
    },
    {
      key: "app_name",
      header: "App",
      width: "120px",
      render: (row) => (
        <Badge variant="secondary" className="text-xs">
          {row.app_name || row.package_name || "Facebook"}
        </Badge>
      )
    },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <span className="font-medium text-sm text-slate-800 dark:text-slate-200">
          {row.title || "—"}
        </span>
      )
    },
    {
      key: "content",
      header: "Content",
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {row.big_text || row.content || "—"}
        </span>
      )
    },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📘 Facebook Messages" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view Facebook activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <Tabs defaultValue="messenger">
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-9">
            <TabsTrigger value="messenger" className="text-xs gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Messenger
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Facebook Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Messenger (reuses shared component) */}
        <TabsContent value="messenger" className="mt-0">
          <SocialChatPage
            platform="facebook"
            platformName="Facebook Messenger"
            platformIcon="📘"
            platformColor="#1877F2"
          />
        </TabsContent>

        {/* Tab 2: Facebook notifications / activity */}
        <TabsContent value="activity" className="mt-0 space-y-4">
          <PageHeader
            title="📘 Facebook Activity"
            description="Likes, follows, comments and notifications captured from Facebook apps"
            actions={<DateRangeFilter date={dateRange} setDate={setDateRange} />}
          />
          <Card className="overflow-hidden border shadow-sm">
            <DataTable<NotificationLog>
              data={activityData}
              columns={activityColumns}
              isLoading={isLoading}
              searchPlaceholder="Search notifications…"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              page={page}
              onPageChange={setPage}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

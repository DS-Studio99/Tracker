"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Bell, MessageCircle, AlertCircle, Heart, UserPlus, MessageSquare } from "lucide-react"
import { DateRange } from "react-day-picker"

import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
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

const INSTAGRAM_PACKAGES = ["com.instagram.android", "com.instagram.lite"]

function guessActivityType(title: string | null, content: string | null): { label: string; icon: React.ReactNode; color: string } {
  const text = `${title ?? ""} ${content ?? ""}`.toLowerCase()
  if (text.includes("like") || text.includes("liked")) return { label: "Like", icon: <Heart className="h-3 w-3" />, color: "text-red-500" }
  if (text.includes("follow") || text.includes("started following")) return { label: "Follow", icon: <UserPlus className="h-3 w-3" />, color: "text-blue-500" }
  if (text.includes("comment") || text.includes("commented")) return { label: "Comment", icon: <MessageSquare className="h-3 w-3" />, color: "text-orange-500" }
  if (text.includes("mention") || text.includes("tagged")) return { label: "Mention", icon: <span>@</span>, color: "text-purple-500" }
  return { label: "Notification", icon: <Bell className="h-3 w-3" />, color: "text-slate-500" }
}

export default function InstagramPage() {
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
      .in("package_name", INSTAGRAM_PACKAGES)
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
      key: "type",
      header: "Type",
      width: "110px",
      render: (row) => {
        const { label, icon, color } = guessActivityType(row.title, row.content)
        return (
          <span className={`flex items-center gap-1 text-xs font-medium ${color}`}>
            {icon} {label}
          </span>
        )
      }
    },
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <span className="font-medium text-sm">
          {row.title || "—"}
        </span>
      )
    },
    {
      key: "content",
      header: "Details",
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
        <PageHeader title="📷 Instagram" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view Instagram activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <Tabs defaultValue="dms">
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-9">
            <TabsTrigger value="dms" className="text-xs gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Direct Messages
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              <Bell className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: DMs */}
        <TabsContent value="dms" className="mt-0">
          <SocialChatPage
            platform="instagram"
            platformName="Instagram"
            platformIcon="📷"
            platformColor="#E4405F"
          />
        </TabsContent>

        {/* Tab 2: Activity (likes, follows, comments) */}
        <TabsContent value="activity" className="mt-0 space-y-4">
          <PageHeader
            title="📷 Instagram Activity"
            description="Likes, follows, comments, mentions and other Instagram notifications"
            actions={<DateRangeFilter date={dateRange} setDate={setDateRange} />}
          />
          <Card className="overflow-hidden border shadow-sm">
            <DataTable
              data={activityData}
              columns={activityColumns}
              isLoading={isLoading}
              searchPlaceholder="Search activity…"
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              page={page}
              pageSize={pageSize}
              totalCount={activityData.length}
              onPageChange={setPage}
            />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

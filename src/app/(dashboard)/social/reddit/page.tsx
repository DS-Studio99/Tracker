"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { BookOpen, Radio, AlertCircle, MessageSquare } from "lucide-react"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"

interface NotificationLog {
  id: string
  device_id: string
  title: string | null
  content: string | null
  timestamp: string
}

export default function RedditPage() {
  const { selectedDeviceId } = useDeviceStore()
  const [activity, setActivity] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")

  const fetchActivity = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from("notification_logs")
      .select("id, device_id, title, content, timestamp")
      .eq("device_id", selectedDeviceId)
      .eq("package_name", "com.reddit.frontpage")
      .order("timestamp", { ascending: false })
      .limit(100)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setActivity(data as NotificationLog[])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  const activityColumns: ColumnDef<NotificationLog>[] = [
    {
      key: "timestamp",
      header: "Date / Time",
      width: "160px",
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
      key: "type",
      header: "Type",
      width: "120px",
      render: (row) => {
        const text = `${row.title} ${row.content}`.toLowerCase()
        if (text.includes("comment")) return <span className="flex items-center gap-1.5 text-xs text-blue-500 font-medium"><MessageSquare className="h-3.5 w-3.5" /> Comment</span>
        return <span className="flex items-center gap-1.5 text-xs text-orange-500 font-medium"><BookOpen className="h-3.5 w-3.5" /> Post / Alert</span>
      }
    },
    {
      key: "title",
      header: "Subreddit / Title",
      render: (row) => (
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 line-clamp-1">
          {row.title || "—"}
        </span>
      )
    },
    {
      key: "content",
      header: "Content",
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
          {row.content || "—"}
        </span>
      )
    },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🤖 Reddit Activity" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view Reddit activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <div className="flex items-start justify-between">
        <PageHeader
          title="🤖 Reddit Activity"
          description="View browsed subreddits, viewed posts, and comments."
        />
        <DateRangeFilter date={dateRange} setDate={setDateRange} />
      </div>

      <Card className="overflow-hidden border shadow-sm mt-4">
        {isLoading ? (
          <div className="p-4 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <DataTable
            data={activity}
            columns={activityColumns}
            isLoading={isLoading}
            searchPlaceholder="Search subreddits or titles…"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        )}
      </Card>
    </div>
  )
}

"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Video, MessageCircle, AlertCircle, Clock, Users } from "lucide-react"
import { DateRange } from "react-day-picker"

import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { SocialMessage } from "@/lib/types/database"

export default function GoogleMeetPage() {
  const { selectedDeviceId } = useDeviceStore()
  const [meetings, setMeetings] = useState<SocialMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")

  const fetchMeetings = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    // Using call_log or video type as proxies for meeting events in Google Meet
    let query = supabase
      .from("social_messages")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .eq("platform", "google_meet")
      .in("message_type", ["call_log", "video", "location"])
      .order("timestamp", { ascending: false })
      .limit(50)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setMeetings(data as SocialMessage[])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchMeetings() }, [fetchMeetings])

  const meetingColumns: ColumnDef<SocialMessage>[] = [
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
      key: "title",
      header: "Meeting Link",
      render: (row) => (
        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <Video className="h-4 w-4 text-emerald-600 shrink-0" />
          {row.group_name || row.body || "Google Meet Logged"}
        </span>
      )
    },
    {
      key: "participants",
      header: "Participants",
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" />
          {row.sender_name || row.receiver_name || "Multiple"}
        </span>
      )
    },
    {
      key: "duration",
      header: "Duration",
      width: "120px",
      render: (row) => (
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          <Clock className="h-3.5 w-3.5" />
          {row.message_type === 'call_log' ? row.media_url || "Unknown" : "Logged"}
        </span>
      )
    },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🎥 Google Meet" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view Google Meet activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <Tabs defaultValue="meetings">
        <div className="flex items-center justify-between mb-4">
          <TabsList className="h-9">
            <TabsTrigger value="meetings" className="text-xs gap-1.5 focus:outline-none">
              <Video className="h-3.5 w-3.5" /> Meeting History
            </TabsTrigger>
            <TabsTrigger value="chat" className="text-xs gap-1.5 focus:outline-none">
              <MessageCircle className="h-3.5 w-3.5" /> In-Meeting Chat
            </TabsTrigger>
          </TabsList>
          
          <DateRangeFilter date={dateRange} setDate={setDateRange} />
        </div>

        {/* Tab 1: Meeting Table */}
        <TabsContent value="meetings" className="mt-0 space-y-4">
          <PageHeader
            title="🎥 Google Meet Meetings"
            description="Captured Google Meet calls and records."
          />
          <Card className="overflow-hidden border shadow-sm">
            <DataTable
              data={meetings}
              columns={meetingColumns}
              isLoading={isLoading}
              searchPlaceholder="Search meetings…"
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
            />
          </Card>
        </TabsContent>

        {/* Tab 2: Team Chat */}
        <TabsContent value="chat" className="mt-0">
          <SocialChatPage
            platform="google_meet"
            platformName="Google Meet"
            platformIcon="🎥"
            platformColor="#00897B"
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

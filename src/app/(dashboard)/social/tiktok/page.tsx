"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { MessageCircle, Video, AlertCircle, PlayCircle } from "lucide-react"
import { DateRange } from "react-day-picker"

import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { SocialMessage } from "@/lib/types/database"

export default function TikTokPage() {
  const { selectedDeviceId } = useDeviceStore()
  const [activity, setActivity] = useState<SocialMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const fetchActivity = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    // Fetch logs categorized typically as watched videos or general TikTok non-DM activity
    let query = supabase
      .from("social_messages")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .eq("platform", "tiktok")
      .in("message_type", ["call_log", "video", "location", "document"]) // Using varied types as placeholders for activity
      .order("timestamp", { ascending: false })
      .limit(50)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setActivity(data as SocialMessage[])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchActivity() }, [fetchActivity])

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🎵 TikTok" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view TikTok activity.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <Tabs defaultValue="messages">
        <div className="flex items-center justify-between mb-2">
          <TabsList className="h-9">
            <TabsTrigger value="messages" className="text-xs gap-1.5">
              <MessageCircle className="h-3.5 w-3.5" /> Messages
            </TabsTrigger>
            <TabsTrigger value="activity" className="text-xs gap-1.5">
              <Video className="h-3.5 w-3.5" /> Watched / Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: DMs */}
        <TabsContent value="messages" className="mt-0">
          <SocialChatPage
            platform="tiktok"
            platformName="TikTok"
            platformIcon="🎵"
            platformColor="#010101"
          />
        </TabsContent>

        {/* Tab 2: Activity Log */}
        <TabsContent value="activity" className="mt-0 space-y-4">
          <PageHeader
            title="🎵 TikTok Watched Videos & Activity"
            description="Videos watched and other captured TikTok activity."
            actions={<DateRangeFilter date={dateRange} setDate={setDateRange} />}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="p-4 flex items-start gap-4">
                  <Skeleton className="h-20 w-16 rounded-md" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                </Card>
              ))
            ) : activity.length === 0 ? (
              <Card className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 border-dashed">
                <PlayCircle className="h-12 w-12 mb-3 opacity-30" />
                <p>No watched videos or activity logged for this period.</p>
              </Card>
            ) : (
              activity.map((item) => (
                <Card key={item.id} className="p-3 hover:shadow-md transition-shadow group flex gap-3 overflow-hidden">
                  <div className="h-24 w-16 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center shrink-0 border relative">
                    {item.media_thumbnail_url || item.media_url ? (
                      <img src={(item.media_thumbnail_url || item.media_url) as string} alt="" className="h-full w-full object-cover rounded opacity-80" loading="lazy" />
                    ) : (
                      <Video className="h-5 w-5 text-slate-400" />
                    )}
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle className="text-white h-6 w-6" />
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 py-1">
                    <h4 className="font-semibold text-sm line-clamp-2 text-slate-800 dark:text-slate-100">
                      {item.body || "Video watched"}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1 capitalize">
                      {item.message_type === "call_log" ? "View Activity" : item.message_type}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-2">
                       {isValid(parseISO(item.timestamp)) ? format(parseISO(item.timestamp), "MMM d, yyyy h:mm a") : ""}
                    </p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

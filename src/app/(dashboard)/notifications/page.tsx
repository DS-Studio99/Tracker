"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, isToday, isYesterday, formatDistanceToNow } from "date-fns"
import {
  Bell, BellOff, AlertCircle, LayoutList, ChevronDown, ChevronRight,
  ChevronUp, BarChart3, Search, Download
} from "lucide-react"
import { DateRange } from "react-day-picker"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { NotificationLog } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const APP_EMOJI: Record<string, string> = {
  chrome: "🌐", whatsapp: "💬", facebook: "📘", instagram: "📷",
  telegram: "✈️", signal: "🔐", twitter: "🐦", gmail: "📧",
  youtube: "▶️", tiktok: "🎵", snapchat: "👻", spotify: "🎶",
  uber: "🚗", maps: "🗺️", calendar: "📅", phone: "📞",
  messages: "💬", settings: "⚙️", news: "📰", amazon: "📦",
}

function appEmoji(name: string | null, pkg: string | null): string {
  const check = (name?.toLowerCase() || "") + (pkg?.toLowerCase() || "")
  for (const [key, emoji] of Object.entries(APP_EMOJI)) {
    if (check.includes(key)) return emoji
  }
  return "🔔"
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (!isValid(d)) return dateStr
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "EEEE, MMMM d, yyyy")
}

const CHART_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#a855f7"
]

export default function NotificationsPage() {
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<NotificationLog[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [appFilter, setAppFilter] = useState<string>("all")
  const [page, setPage] = useState(0)
  const [groupByApp, setGroupByApp] = useState(false)
  const [statsOpen, setStatsOpen] = useState(true)
  const [collapsedApps, setCollapsedApps] = useState<Set<string>>(new Set())
  const PAGE_SIZE = 50

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("notification_logs")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())
    if (appFilter !== "all") query = query.ilike("app_name", `%${appFilter}%`)

    const { data: result } = await query
    setData(prev => page === 0 ? (result as NotificationLog[] || []) : [...prev, ...(result as NotificationLog[] || [])])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange, appFilter, page])

  useEffect(() => {
    setPage(0)
    setData([])
  }, [selectedDeviceId, dateRange, appFilter, searchQuery])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const q = searchQuery.toLowerCase()
    return data.filter(d =>
      (d.title && d.title.toLowerCase().includes(q)) ||
      (d.content && d.content.toLowerCase().includes(q)) ||
      (d.app_name && d.app_name.toLowerCase().includes(q))
    )
  }, [data, searchQuery])

  const uniqueApps = useMemo(() => {
    const apps = new Set(data.map(d => d.app_name).filter(Boolean) as string[])
    return Array.from(apps).sort()
  }, [data])

  // Stats: top 5 apps
  const topApps = useMemo(() => {
    const counts: Record<string, number> = {}
    data.forEach(d => {
      const name = d.app_name || "Unknown"
      counts[name] = (counts[name] || 0) + 1
    })
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count }))
  }, [data])

  // Stats: per-hour distribution
  const perHour = useMemo(() => {
    const counts = Array.from({ length: 24 }, (_, i) => ({ hour: `${i}:00`, count: 0 }))
    data.forEach(d => {
      const h = isValid(parseISO(d.timestamp)) ? parseISO(d.timestamp).getHours() : -1
      if (h >= 0) counts[h].count++
    })
    return counts
  }, [data])

  // Group for timeline by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, NotificationLog[]> = {}
    for (const entry of filteredData) {
      const dateKey = isValid(parseISO(entry.timestamp)) ? format(parseISO(entry.timestamp), "yyyy-MM-dd") : "unknown"
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(entry)
    }
    return groups
  }, [filteredData])

  // Group by app for grouped view
  const groupedByApp = useMemo(() => {
    const groups: Record<string, NotificationLog[]> = {}
    for (const entry of filteredData) {
      const appKey = entry.app_name || "Unknown App"
      if (!groups[appKey]) groups[appKey] = []
      groups[appKey].push(entry)
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [filteredData])

  const toggleAppCollapse = (key: string) => {
    setCollapsedApps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const exportColumns = [
    { key: "timestamp", header: "Date" },
    { key: "app_name", header: "App" },
    { key: "title", header: "Title" },
    { key: "content", header: "Content" },
    { key: "category", header: "Category" },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🔔 Notification History" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view notification history.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="🔔 Notification History"
          description="All notifications received on the device."
        />
        <div className="flex items-center gap-2">
          <ExportButton data={filteredData} columns={exportColumns} filename="notifications" />
        </div>
      </div>

      {/* Stats Panel */}
      <Collapsible open={statsOpen} onOpenChange={setStatsOpen}>
        <Card className="border shadow-sm overflow-hidden">
          <CollapsibleTrigger>
            <button className="w-full flex items-center justify-between px-4 py-3 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-slate-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Notification Statistics</span>
                <Badge variant="secondary" className="ml-1 text-[10px]">{data.length} total</Badge>
              </div>
              {statsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Apps */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Top 5 Apps</h4>
                {topApps.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No data yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={topApps} layout="vertical" barSize={14} margin={{ left: 40, right: 20 }}>
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
                      <Tooltip
                        formatter={(val: any) => [val, "Notifications"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {topApps.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Per Hour */}
              <div>
                <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Activity by Hour</h4>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={perHour} barSize={8} margin={{ left: -20, right: 10 }}>
                    <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={3} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any) => [val, "Notifications"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Bar dataKey="count" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Filters + Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <DateRangeFilter date={dateRange} setDate={setDateRange} />

        <Select value={appFilter} onValueChange={(val) => setAppFilter(val || "all")}>
          <SelectTrigger className="w-[200px] h-9">
            <SelectValue placeholder="Filter by App" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Apps</SelectItem>
            {uniqueApps.map(app => (
              <SelectItem key={app} value={app}>{app}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search title or content..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <Switch id="group-app" checked={groupByApp} onCheckedChange={setGroupByApp} />
          <Label htmlFor="group-app" className="text-sm font-medium cursor-pointer">Group by App</Label>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && page === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4 flex gap-3">
              <Skeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredData.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-16 border-dashed">
          <BellOff className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No notifications found.</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or date range.</p>
        </Card>
      )}

      {/* ── GROUPED BY APP ── */}
      {!isLoading && filteredData.length > 0 && groupByApp && (
        <div className="space-y-3">
          {groupedByApp.map(([appName, entries]) => {
            const isCollapsed = collapsedApps.has(appName)
            return (
              <Card key={appName} className="overflow-hidden border shadow-sm">
                <Collapsible open={!isCollapsed} onOpenChange={() => toggleAppCollapse(appName)}>
                  <CollapsibleTrigger>
                    <button className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-200 dark:border-slate-800">
                      <span className="text-xl">{appEmoji(appName, null)}</span>
                      <div className="flex-1 text-left">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{appName}</span>
                      </div>
                      <Badge variant="secondary" className="text-[11px]">{entries.length}</Badge>
                      {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                      {entries.map(entry => (
                        <NotificationItem key={entry.id} entry={entry} />
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── CHRONOLOGICAL TIMELINE ── */}
      {!isLoading && filteredData.length > 0 && !groupByApp && (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateKey, entries]) => (
            <div key={dateKey} className="space-y-2">
              {/* Date Separator */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                  {dayLabel(dateKey + "T00:00:00")}
                </span>
                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
              </div>

              <Card className="overflow-hidden border shadow-sm divide-y divide-slate-100 dark:divide-slate-800/70">
                {entries.map(entry => (
                  <NotificationItem key={entry.id} entry={entry} />
                ))}
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {filteredData.length >= (page + 1) * PAGE_SIZE && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
            {isLoading ? "Loading..." : "Load More"}
          </Button>
        </div>
      )}
    </div>
  )
}

// ── Notification Item component ──
function NotificationItem({ entry }: { entry: NotificationLog }) {
  const [expanded, setExpanded] = useState(false)
  const ts = isValid(parseISO(entry.timestamp)) ? parseISO(entry.timestamp) : null

  return (
    <div className="px-4 py-3 flex gap-3 hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors">
      {/* App Icon */}
      <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center text-lg shrink-0 border border-slate-200 dark:border-slate-700">
        {appEmoji(entry.app_name, entry.package_name)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
            {entry.app_name || "Unknown App"}
          </span>
          {entry.category && (
            <Badge variant="outline" className="text-[9px] h-4 px-1.5 uppercase tracking-wider">
              {entry.category}
            </Badge>
          )}
          <span className="text-[11px] text-slate-400 ml-auto whitespace-nowrap">
            {ts ? formatDistanceToNow(ts, { addSuffix: true }) : ""}
          </span>
        </div>

        {entry.title && (
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 mt-0.5 leading-snug">
            {entry.title}
          </p>
        )}

        {entry.content && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
            {entry.content}
          </p>
        )}

        {entry.big_text && (
          <div>
            {!expanded ? (
              <button
                onClick={() => setExpanded(true)}
                className="text-xs text-indigo-500 hover:underline mt-1 flex items-center gap-1"
              >
                <ChevronDown className="h-3 w-3" /> Show more
              </button>
            ) : (
              <>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed whitespace-pre-wrap">
                  {entry.big_text}
                </p>
                <button
                  onClick={() => setExpanded(false)}
                  className="text-xs text-indigo-500 hover:underline mt-1 flex items-center gap-1"
                >
                  <ChevronUp className="h-3 w-3" /> Show less
                </button>
              </>
            )}
          </div>
        )}

        <p className="text-[10px] text-slate-400 mt-1">
          {ts ? format(ts, "MMM d, yyyy · h:mm:ss a") : ""}
        </p>
      </div>
    </div>
  )
}

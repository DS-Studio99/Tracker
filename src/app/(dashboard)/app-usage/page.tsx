"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, subDays, startOfDay, endOfDay, eachDayOfInterval } from "date-fns"
import { Clock, Activity, BarChart3, TrendingUp, TrendingDown, Hourglass } from "lucide-react"
import { 
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, Cell, CartesianGrid, Legend 
} from "recharts"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { AppUsage } from "@/lib/types/database"
import { cn } from "@/lib/utils"

function formatDuration(ms: number) {
  if (!ms || ms <= 0) return "0s"
  const totalMins = Math.floor(ms / 60000)
  if (totalMins === 0) return `${Math.floor(ms / 1000)}s`
  if (totalMins < 60) return `${totalMins} min`
  const hrs = Math.floor(totalMins / 60)
  const mins = totalMins % 60
  return `${hrs}h ${mins}m`
}

const CHART_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#a855f7"]

export default function AppUsagePage() {
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<AppUsage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 7),
    to: new Date()
  }))
  const [appFilter, setAppFilter] = useState("all")

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("app_usage")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("start_time", { ascending: false })

    if (dateRange?.from) query = query.gte("start_time", startOfDay(dateRange.from).toISOString())
    if (dateRange?.to) query = query.lte("start_time", endOfDay(dateRange.to).toISOString())

    const { data: result } = await query
    setData((result as AppUsage[]) || [])
    setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredData = useMemo(() => {
    if (appFilter === "all") return data
    return data.filter(d => 
      (d.app_name && d.app_name.toLowerCase().includes(appFilter.toLowerCase())) || 
      (d.package_name && d.package_name.toLowerCase().includes(appFilter.toLowerCase()))
    )
  }, [data, appFilter])

  const uniqueApps = useMemo(() => {
    const apps = new Set(data.map(d => d.app_name || d.package_name).filter(Boolean) as string[])
    return Array.from(apps).sort()
  }, [data])

  // Charts Aggregation
  const summaryStats = useMemo(() => {
    const today = startOfDay(new Date())
    const yesterday = subDays(today, 1)

    let msToday = 0
    let msYesterday = 0

    data.forEach(d => {
      const ts = parseISO(d.start_time)
      if (!isValid(ts)) return
      if (ts >= today) msToday += (d.duration || 0)
      else if (ts >= yesterday && ts < today) msYesterday += (d.duration || 0)
    })

    const diff = msToday - msYesterday
    const isUp = diff > 0
    
    return {
      todayFormatted: formatDuration(msToday),
      diffFormatted: formatDuration(Math.abs(diff)),
      isUp,
      msToday
    }
  }, [data])

  // Trend Area Chart data (Last X days total usage)
  const trendData = useMemo(() => {
    if (!dateRange?.from || !dateRange?.to) return []
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
    
    const map: Record<string, number> = {}
    days.forEach(d => map[format(d, "yyyy-MM-dd")] = 0)

    filteredData.forEach(d => {
      const ts = parseISO(d.start_time)
      if (!isValid(ts)) return
      const dateKey = format(ts, "yyyy-MM-dd")
      if (map[dateKey] !== undefined) {
        map[dateKey] += (d.duration || 0)
      }
    })

    return Object.entries(map).map(([date, ms]) => ({
      date: format(parseISO(date), "MMM d"),
      hours: parseFloat((ms / 3600000).toFixed(2)) // Convert to hours for charting
    }))
  }, [filteredData, dateRange])

  // Top Apps Chart Data
  const topAppsData = useMemo(() => {
    const map: Record<string, number> = {}
    filteredData.forEach(d => {
      const name = d.app_name || d.package_name || "Unknown"
      map[name] = (map[name] || 0) + (d.duration || 0)
    })

    return Object.entries(map)
      .map(([name, ms]) => ({ name, mins: Math.round(ms / 60000) }))
      .sort((a, b) => b.mins - a.mins)
      .slice(0, 10)
      .filter(a => a.mins > 0)
  }, [filteredData])

  // Data Table Columns
  const columns: ColumnDef<AppUsage>[] = [
    {
      key: "app_name",
      header: "Application",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{row.app_name || row.package_name || "Unknown"}</span>
        </div>
      )
    },
    {
      key: "duration",
      header: "Session Duration",
      render: (row) => (
        <Badge variant="outline" className="font-mono bg-slate-50 dark:bg-slate-900">
           {formatDuration(row.duration)}
        </Badge>
      )
    },
    {
      key: "start_time",
      header: "Start Time",
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
           {row.start_time && isValid(parseISO(row.start_time)) 
             ? format(parseISO(row.start_time), "MMM d, yyyy h:mm:ss a") 
             : "Unknown"}
        </span>
      )
    },
    {
      key: "end_time",
      header: "End Time",
      render: (row) => (
        <span className="text-sm text-slate-600 dark:text-slate-300 whitespace-nowrap">
           {row.end_time && isValid(parseISO(row.end_time)) 
             ? format(parseISO(row.end_time), "MMM d, yyyy h:mm:ss a") 
             : "Ongoing / Not Recorded"}
        </span>
      )
    }
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="⏳ App Usage & Screen Time" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Hourglass className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view detailed usage statistics.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="⏳ App Usage & Screen Time"
          description="Detailed breakdown of application usage and sessions."
        />
        <div className="flex items-center gap-2">
          <Select value={appFilter} onValueChange={(val) => val && setAppFilter(val)}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Filter by App" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Apps</SelectItem>
              {uniqueApps.map(app => (
                <SelectItem key={app} value={app}>{app}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DateRangeFilter date={dateRange} setDate={setDateRange} />
        </div>
      </div>

      {/* Screen Time Summary Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         {/* KPI Card */}
         <Card className="flex flex-col justify-center p-6 border shadow-sm col-span-1 border-l-4 border-l-indigo-500">
           <div className="flex items-center gap-3 mb-4">
             <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg text-indigo-600 dark:text-indigo-400">
               <Clock className="h-6 w-6" />
             </div>
             <h3 className="font-semibold text-lg text-slate-800 dark:text-slate-100">Screen Time Today</h3>
           </div>
           
           <h2 className="text-4xl font-bold text-slate-900 dark:text-slate-50 mb-2">
             {summaryStats.todayFormatted}
           </h2>
           
           <div className="flex items-center gap-1.5 mt-2">
             {summaryStats.isUp ? (
               <TrendingUp className="h-4 w-4 text-rose-500" />
             ) : (
               <TrendingDown className="h-4 w-4 text-emerald-500" />
             )}
             <span className={cn("text-sm font-medium", summaryStats.isUp ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400")}>
               {summaryStats.diffFormatted} {summaryStats.isUp ? "more" : "less"} than yesterday
             </span>
           </div>
         </Card>

         {/* Trend Chart */}
         <Card className="col-span-1 lg:col-span-2 border shadow-sm">
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-semibold flex items-center gap-2 text-slate-600 uppercase tracking-wider">
               <Activity className="h-4 w-4" /> Trend (Hours / Day)
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-[140px] w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                       <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                   <XAxis dataKey="date" tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                   <YAxis tick={{fontSize: 10}} tickLine={false} axisLine={false} />
                   <Tooltip 
                     formatter={(value: any) => [`${value} hrs`, "Usage"]}
                     contentStyle={{ borderRadius: 8, fontSize: 12 }}
                   />
                   <Area type="monotone" dataKey="hours" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorUsage)" />
                 </AreaChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
      </div>

      {/* Top Apps Chart */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Top Applications in Period</CardTitle>
          <CardDescription>Most used apps based on total session durations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] w-full mt-4">
             {topAppsData.length === 0 ? (
               <div className="h-full w-full flex items-center justify-center text-slate-400">
                 No usage data recorded for the selected period.
               </div>
             ) : (
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={topAppsData} layout="vertical" barSize={20} margin={{ left: 80, right: 20 }}>
                   <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                   <XAxis type="number" tick={{fontSize: 11}} />
                   <YAxis type="category" dataKey="name" tick={{fontSize: 11}} width={120} axisLine={false} tickLine={false} />
                   <Tooltip 
                     formatter={(value: any) => [`${value} min`, "Usage Time"]}
                     contentStyle={{ borderRadius: 8, fontSize: 12 }}
                   />
                   <Bar dataKey="mins" radius={[0, 4, 4, 0]}>
                     {topAppsData.map((_, index) => (
                       <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                     ))}
                   </Bar>
                 </BarChart>
               </ResponsiveContainer>
             )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Sessions Table */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-0">
           <CardTitle className="text-lg">Individual Usage Sessions</CardTitle>
           <CardDescription>Chronological log of every time an app was opened and closed.</CardDescription>
        </CardHeader>
        <div className="p-0">
          <DataTable<AppUsage>
            data={filteredData}
            columns={columns}
            isLoading={isLoading}
            searchable={false}
          />
        </div>
      </Card>
    </div>
  )
}

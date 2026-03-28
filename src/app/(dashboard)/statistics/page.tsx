"use client"

import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { format, parseISO, subDays, startOfDay, endOfDay, eachDayOfInterval, isSameDay } from "date-fns"
import dynamic from "next/dynamic"
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts"
import {
  MessageSquare, Phone, Users, Box, Share2, Globe, Bell, MapPin, 
  AlignLeft, AlignCenter, Loader2
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"

const StatMap = dynamic(() => import("@/components/dashboard/stat-map"), {
  ssr: false,
  loading: () => <Skeleton className="w-full h-[300px] rounded-lg" />
})

// ── Colors ──────────────────────────────────────────────────
const COLORS = ["#4f46e5", "#ec4899", "#f59e0b", "#10b981", "#8b5cf6", "#06b6d4", "#f43f5e", "#84cc16"]
const PIE_COLORS = ["#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#6366f1", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#a855f7"]

// ── Custom Tooltips ─────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 rounded-lg shadow-xl text-sm">
        <p className="font-semibold text-slate-800 dark:text-slate-200 mb-2">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-600 dark:text-slate-400 font-medium capitalize">{entry.name}:</span>
              <span className="font-bold text-slate-900 dark:text-white capitalize truncate max-w-[150px]">{entry.value}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }
  return null
}

// ── Chart Containers ────────────────────────────────────────
function ChartCard({ title, icon: Icon, children, desc }: { title: string, icon?: any, children: React.ReactNode, desc?: string }) {
  return (
    <Card className="flex flex-col h-full border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
      <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-indigo-500" />}
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
        {desc && <CardDescription className="text-[11px] leading-tight mt-1">{desc}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1 p-4 w-full h-[300px]">
        {children}
      </CardContent>
    </Card>
  )
}

function SectionHeader({ title, icon: Icon }: { title: string, icon: any }) {
  return (
    <div className="flex items-center gap-2 mt-8 mb-4">
      <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-lg">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-lg font-bold tracking-tight text-slate-800 dark:text-slate-200">{title}</h2>
      <div className="flex-1 border-t border-slate-200 dark:border-slate-800 ml-4" />
    </div>
  )
}

function Loader() {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin mb-2" />
      <span className="text-xs">Processing analytics...</span>
    </div>
  )
}

// ── Main Dashboard ──────────────────────────────────────────
export default function StatisticsPage() {
  const { selectedDeviceId } = useDeviceStore()
  const [rangeStr, setRangeStr] = useState("7")

  const dateRange = useMemo(() => {
    const today = new Date()
    const days = parseInt(rangeStr)
    return {
      from: startOfDay(subDays(today, days - 1)),
      to: endOfDay(today),
      days
    }
  }, [rangeStr])

  const dateList = useMemo(() => {
    return eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
  }, [dateRange])

  // Helpers
  const eqDev = "device_id"
  const fetchSup = async (table: string, cols = "timestamp"): Promise<any[]> => {
    if (!selectedDeviceId) return []
    const sup = createClient()
    const { data } = await sup.from(table).select(cols)
      .eq(eqDev, selectedDeviceId)
      .gte("timestamp", dateRange.from.toISOString())
      .lte("timestamp", dateRange.to.toISOString())
      .limit(10000)
    return data || []
  }

  // ── Queries ─────────────────────────────────────────────

  // Communication Activity
  const { data: qSms, isLoading: lSms } = useQuery({
    queryKey: ["stat_sms", selectedDeviceId, rangeStr],
    queryFn: () => fetchSup("sms_messages", "timestamp, message_type, sender_number, receiver_number"),
    enabled: !!selectedDeviceId
  })

  const { data: qCalls, isLoading: lCalls } = useQuery({
    queryKey: ["stat_calls", selectedDeviceId, rangeStr],
    queryFn: () => fetchSup("call_logs", "timestamp, call_type, duration, phone_number, contact_name"),
    enabled: !!selectedDeviceId
  })

  // App Usage
  const { data: qApps, isLoading: lApps } = useQuery({
    queryKey: ["stat_apps", selectedDeviceId, rangeStr],
    queryFn: async (): Promise<any[]> => {
      if (!selectedDeviceId) return []
      const { data } = await createClient().from("app_usage").select("start_time, duration, app_name")
        .eq(eqDev, selectedDeviceId).gte("start_time", dateRange.from.toISOString()).limit(10000)
      return data || []
    },
    enabled: !!selectedDeviceId
  })

  // Social Media
  const { data: qSocial, isLoading: lSocial } = useQuery({
    queryKey: ["stat_social", selectedDeviceId, rangeStr],
    queryFn: () => fetchSup("social_messages", "timestamp, platform, direction"),
    enabled: !!selectedDeviceId
  })

  // Internet & Location
  const { data: qWeb, isLoading: lWeb } = useQuery({
    queryKey: ["stat_web", selectedDeviceId, rangeStr],
    queryFn: () => fetchSup("browser_history", "timestamp, url"),
    enabled: !!selectedDeviceId
  })

  const { data: qLoc, isLoading: lLoc } = useQuery({
    queryKey: ["stat_loc", selectedDeviceId, rangeStr],
    queryFn: () => fetchSup("locations", "timestamp, latitude, longitude"),
    enabled: !!selectedDeviceId
  })

  // Notifications
  const { data: qNotif, isLoading: lNotif } = useQuery({
    queryKey: ["stat_notif", selectedDeviceId, rangeStr],
    queryFn: () => fetchSup("notification_logs", "timestamp, app_name"),
    enabled: !!selectedDeviceId
  })

  // ── Aggregations ────────────────────────────────────────

  // Sect A: Comms By Day
  const commsByDay = useMemo(() => {
    return dateList.map(date => {
      const smsIn = (qSms || []).filter(s => s.message_type === "incoming" && isSameDay(parseISO(s.timestamp), date)).length
      const smsOut = (qSms || []).filter(s => s.message_type === "outgoing" && isSameDay(parseISO(s.timestamp), date)).length
      const callIn = (qCalls || []).filter(c => c.call_type === "incoming" && isSameDay(parseISO(c.timestamp), date)).length
      const callOut = (qCalls || []).filter(c => c.call_type === "outgoing" && isSameDay(parseISO(c.timestamp), date)).length
      const callMiss = (qCalls || []).filter(c => c.call_type === "missed" && isSameDay(parseISO(c.timestamp), date)).length
      return {
        dateStr: format(date, "MMM d"),
        smsIn, smsOut,
        callIn, callOut, callMiss
      }
    })
  }, [dateList, qSms, qCalls])

  // Sect B: Call Analysis (Duration + Time)
  const callAnalysisData = useMemo(() => {
    const buckets = { "0-30s": 0, "30s-1m": 0, "1-5m": 0, "5-15m": 0, "15-30m": 0, "30m+": 0 }
    const hours = Array.from({length: 24}).map((_, i) => ({ hour: `${i}:00`, count: 0 }))
    
    ;(qCalls || []).forEach(c => {
      const d = c.duration || 0
      if (d <= 30) buckets["0-30s"]++
      else if (d <= 60) buckets["30s-1m"]++
      else if (d <= 300) buckets["1-5m"]++
      else if (d <= 900) buckets["5-15m"]++
      else if (d <= 1800) buckets["15-30m"]++
      else buckets["30m+"]++

      const h = parseISO(c.timestamp).getHours()
      hours[h].count++
    })
    return {
      durationBuckets: Object.entries(buckets).map(([name, count]) => ({ name, count })),
      hourly: hours
    }
  }, [qCalls])

  // Sect C: Top Contacts
  const topContacts = useMemo(() => {
    const map = new Map<string, { name: string, sms: number, calls: number }>()
    
    ;(qSms || []).forEach(s => {
      const num = s.message_type === 'incoming' ? s.sender_number : s.receiver_number
      if (!num) return
      if (!map.has(num)) map.set(num, { name: num, sms: 0, calls: 0 })
      map.get(num)!.sms++
    })
    
    ;(qCalls || []).forEach(c => {
      const num = c.phone_number
      if (!num) return
      if (!map.has(num)) map.set(num, { name: c.contact_name || num, sms: 0, calls: 0 })
      map.get(num)!.calls++
      if (c.contact_name && map.get(num)!.name === num) map.get(num)!.name = c.contact_name // update name if found
    })

    const list = Array.from(map.values())
      .map(v => ({ ...v, total: v.sms + v.calls }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
    
    return list
  }, [qSms, qCalls])

  // Sect D: App Usage (Top Apps + Screen Time)
  const appData = useMemo(() => {
    const map = new Map<string, number>()
    const dailyMap = new Map<string, number>()

    ;(qApps || []).forEach(a => {
      const nm = a.app_name || "Unknown"
      map.set(nm, (map.get(nm) || 0) + (a.duration || 0))

      const dStr = format(parseISO(a.start_time), "MMM d")
      dailyMap.set(dStr, (dailyMap.get(dStr) || 0) + (a.duration || 0))
    })

    const topApps = Array.from(map.entries())
      .map(([name, dur]) => ({ name, durationHours: parseFloat((dur / 3600).toFixed(2)) }))
      .sort((a, b) => b.durationHours - a.durationHours)
      .slice(0, 10)
    
    const dailyScreenTime = dateList.map(date => {
      const dStr = format(date, "MMM d")
      return {
        dateStr: dStr,
        hours: parseFloat(((dailyMap.get(dStr) || 0) / 3600).toFixed(2))
      }
    })

    return { topApps, dailyScreenTime }
  }, [qApps, dateList])

  // Sect E: Social Media
  const socialData = useMemo(() => {
    const pmap = new Map<string, number>()
    const dailyObj: Record<string, any> = {}

    dateList.forEach(d => {
      dailyObj[format(d, "MMM d")] = { dateStr: format(d, "MMM d") }
    })

    ;(qSocial || []).forEach(s => {
      const p = s.platform || "other"
      pmap.set(p, (pmap.get(p) || 0) + 1)
      
      const dStr = format(parseISO(s.timestamp), "MMM d")
      if (!dailyObj[dStr][p]) dailyObj[dStr][p] = 0
      dailyObj[dStr][p]++
    })

    const topPlatforms = Array.from(pmap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7) // Top 7 for rendering
    
    return {
      topPlatforms,
      dailyPlats: Object.values(dailyObj),
      platKeys: topPlatforms.map(p => p.name)
    }
  }, [qSocial, dateList])

  // Sect F: Website & Locations
  const webData = useMemo(() => {
    const dMap = new Map<string, number>()
    ;(qWeb || []).forEach(w => {
      try {
        let domain = new URL(w.url).hostname
        domain = domain.replace(/^www\./, "")
        dMap.set(domain, (dMap.get(domain) || 0) + 1)
      } catch {}
    })
    return Array.from(dMap.entries())
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7)
  }, [qWeb])

  const locCoords = useMemo(() => {
    // Keep reasonable chunk for the heatmap map
    return (qLoc || []).slice(0, 500).map(l => ({ lat: l.latitude, lng: l.longitude }))
  }, [qLoc])

  // Sect G: Notifications
  const notifData = useMemo(() => {
    const aMap = new Map<string, number>()
    const hours = Array.from({length: 24}).map((_, i) => ({ hour: `${i}:00`, count: 0 }))

    ;(qNotif || []).forEach(n => {
      const app = n.app_name || "System"
      aMap.set(app, (aMap.get(app) || 0) + 1)
      const h = parseISO(n.timestamp).getHours()
      hours[h].count++
    })

    const topApps = Array.from(aMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8)

    return { topApps, hours }
  }, [qNotif])

  // ── Render Helpers ──────────────────────────────────────────
  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📊 Statistics & Analytics" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
           <AlignCenter className="h-10 w-10 text-slate-400 mb-4" />
           <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
           <p className="text-slate-500 max-w-sm">Please select a device to view comprehensive analytics.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-[100px] animate-in fade-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader 
          title="📊 Statistics & Analytics" 
          description="In-depth analysis of device activity, communications, and patterns over time."
        />
        <Select value={rangeStr} onValueChange={(v) => v && setRangeStr(v)}>
          <SelectTrigger className="w-[180px] bg-white dark:bg-slate-900 border shadow-sm shrink-0 font-medium">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Today</SelectItem>
            <SelectItem value="7">Last 7 Days</SelectItem>
            <SelectItem value="30">Last 30 Days</SelectItem>
            <SelectItem value="90">Last 90 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── SECTION A: Communications ── */}
      <SectionHeader title="Communication Activity" icon={MessageSquare} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Messages Per Day" desc="Total SMS text messages exchanged over time.">
           {lSms ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={commsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                   </linearGradient>
                   <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="dateStr" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip content={<CustomTooltip />} />
                 <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                 <Area type="monotone" name="Incoming" dataKey="smsIn" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)" />
                 <Area type="monotone" name="Outgoing" dataKey="smsOut" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)" />
               </AreaChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <ChartCard title="Calls Per Day" desc="Call volume broken down by log type.">
           {lCalls ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={commsByDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="dateStr" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }}/>
                 <Legend iconType="circle" wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
                 <Bar name="Incoming" dataKey="callIn" stackId="a" fill="#10b981" radius={[0, 0, 4, 4]} />
                 <Bar name="Outgoing" dataKey="callOut" stackId="a" fill="#3b82f6" />
                 <Bar name="Missed" dataKey="callMiss" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           )}
         </ChartCard>
      </div>

      {/* ── SECTION B: Call Analysis ── */}
      <SectionHeader title="Call Analysis" icon={Phone} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Call Duration Distribution" desc="Groups of call lengths.">
           {lCalls ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={callAnalysisData.durationBuckets} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                 <Bar name="Total Calls" dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <ChartCard title="Calls by Time of Day" desc="Aggregate call count per hour.">
           {lCalls ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={callAnalysisData.hourly} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorHr" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4}/>
                     <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={3} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip content={<CustomTooltip />} />
                 <Area type="monotone" name="Calls" dataKey="count" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorHr)" />
               </AreaChart>
             </ResponsiveContainer>
           )}
         </ChartCard>
      </div>

      {/* ── SECTION C: Top Contacts ── */}
      <SectionHeader title="Top Contacts" icon={Users} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Top 10 Most Contacted" desc="Total interactions across SMS & Calls.">
           {lSms || lCalls ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={topContacts} layout="vertical" margin={{ top: 0, right: 10, left: 20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={80} />
                 <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                 <Bar name="SMS" dataKey="sms" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                 <Bar name="Calls" dataKey="calls" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                 <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
               </BarChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden h-full max-h-[360px] flex flex-col">
           <CardHeader className="p-4 bg-slate-50/50 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-800/50 shrink-0">
             <CardTitle className="text-sm font-semibold flex items-center gap-2"><AlignLeft className="h-4 w-4 text-indigo-500"/> Contact Breakdown</CardTitle>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-auto">
             <table className="w-full text-sm text-left">
               <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 sticky top-0 border-b border-slate-200 dark:border-slate-800">
                 <tr>
                   <th className="px-4 py-2 font-medium">Name / Number</th>
                   <th className="px-4 py-2 font-medium text-right">SMS</th>
                   <th className="px-4 py-2 font-medium text-right">Calls</th>
                   <th className="px-4 py-2 font-medium text-right text-indigo-600 dark:text-indigo-400">Total</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                 {topContacts.map((c, i) => (
                   <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-900/40">
                     <td className="px-4 py-3 font-semibold truncate max-w-[150px]">{c.name}</td>
                     <td className="px-4 py-3 text-right">{c.sms}</td>
                     <td className="px-4 py-3 text-right">{c.calls}</td>
                     <td className="px-4 py-3 text-right font-bold text-indigo-600 dark:text-indigo-400">{c.total}</td>
                   </tr>
                 ))}
                 {topContacts.length === 0 && !lSms && !lCalls && (
                   <tr><td colSpan={4} className="p-8 text-center text-slate-400">No contact data</td></tr>
                 )}
               </tbody>
             </table>
           </CardContent>
         </Card>
      </div>

      {/* ── SECTION D: App Usage ── */}
      <SectionHeader title="Application Usage" icon={Box} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Top 10 Most Used Apps" desc="Hours spent on device applications.">
           {lApps ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={appData.topApps} dataKey="durationHours" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={90} label={({name, percent}) => percent && percent > 0.05 ? `${name} (${(percent * 100).toFixed(0)}%)` : null} paddingAngle={2}>
                   {appData.topApps.map((_, i) => <Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                 </Pie>
                 <Tooltip content={<CustomTooltip />} />
               </PieChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <ChartCard title="Screen Time Per Day" desc="Total active hours spent on all apps.">
           {lApps ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={appData.dailyScreenTime} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorScr" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#ec4899" stopOpacity={0.4}/>
                     <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="dateStr" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip content={<CustomTooltip />} />
                 <Area type="monotone" name="Hours" dataKey="hours" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorScr)" />
               </AreaChart>
             </ResponsiveContainer>
           )}
         </ChartCard>
      </div>

      {/* ── SECTION E: Social Media ── */}
      <SectionHeader title="Social Media Intelligence" icon={Share2} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Messages Sent/Received" desc="Message volume by social chat platform.">
           {lSocial ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={socialData.topPlatforms} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                 <Bar name="Messages" dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                   {socialData.topPlatforms.map((p, i) => (
                     <Cell key={i} fill={COLORS[i % COLORS.length]} />
                   ))}
                 </Bar>
               </BarChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <ChartCard title="Platform Trends over Time" desc="Activity intensity separated by top platforms.">
           {lSocial ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={socialData.dailyPlats} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="dateStr" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip content={<CustomTooltip />} />
                 {socialData.platKeys.map((pKey, idx) => (
                   <Area key={pKey} type="monotone" dataKey={pKey} name={pKey} stackId="1" 
                     stroke={COLORS[idx % COLORS.length]} fill={COLORS[idx % COLORS.length]} fillOpacity={0.6} 
                   />
                 ))}
               </AreaChart>
             </ResponsiveContainer>
           )}
         </ChartCard>
      </div>

      {/* ── SECTION F: Internet & Location ── */}
      <SectionHeader title="Internet & Location" icon={Globe} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Top 5 Visited Domains" desc="Most frequently open browser websites.">
           {lWeb ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={webData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis type="number" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <YAxis dataKey="domain" type="category" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} width={110} />
                 <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                 <Bar name="Visits" dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} barSize={24} />
               </BarChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <Card className="flex flex-col h-full border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
           <CardHeader className="p-4 pb-2 border-b border-slate-100 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/40">
             <div className="flex items-center gap-2">
               <MapPin className="h-4 w-4 text-indigo-500" />
               <CardTitle className="text-sm font-semibold">Location Hotspots</CardTitle>
             </div>
             <CardDescription className="text-[11px] leading-tight mt-1">Cluster map of device movement.</CardDescription>
           </CardHeader>
           <CardContent className="flex-1 p-0 w-full h-[300px]">
             {lLoc ? <Loader /> : (
               <StatMap locations={locCoords} />
             )}
           </CardContent>
         </Card>
      </div>

      {/* ── SECTION G: Notifications ── */}
      <SectionHeader title="System Notifications" icon={Bell} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         <ChartCard title="Notifications by App" desc="Top sources of status bar notifications.">
           {lNotif ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <PieChart>
                 <Pie data={notifData.topApps} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({name, percent}) => percent && percent > 0.05 ? name : null}>
                   {notifData.topApps.map((_, i) => <Cell key={`c-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                 </Pie>
                 <Tooltip content={<CustomTooltip />} />
               </PieChart>
             </ResponsiveContainer>
           )}
         </ChartCard>

         <ChartCard title="Notifications Traffic" desc="Hourly breakdown of when notifications arrive.">
           {lNotif ? <Loader /> : (
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={notifData.hours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10 dark:opacity-20" />
                 <XAxis dataKey="hour" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} interval={3} />
                 <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                 <Tooltip cursor={{ fill: 'transparent' }} content={<CustomTooltip />} />
                 <Bar name="Notifications" dataKey="count" fill="#14b8a6" radius={[2, 2, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
           )}
         </ChartCard>
      </div>

    </div>
  )
}

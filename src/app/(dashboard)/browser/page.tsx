"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, subDays, startOfDay } from "date-fns"
import { Globe, ShieldAlert, AlertCircle, ExternalLink, ChevronDown, ChevronUp } from "lucide-react"
import { DateRange } from "react-day-picker"
import { BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from "recharts"
import { toast } from "sonner"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { BrowserHistory, DeviceSettings, RemoteCommand } from "@/lib/types/database"

const BROWSERS = ["All", "Chrome", "Firefox", "Samsung Internet", "Opera", "Other"]

export default function BrowserHistoryPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [data, setData] = useState<BrowserHistory[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [browserFilter, setBrowserFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [statsOpen, setStatsOpen] = useState(true)
  
  const [selectedItem, setSelectedItem] = useState<BrowserHistory | null>(null)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const [isBlockAlertOpen, setIsBlockAlertOpen] = useState(false)

  // Fetch Data
  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    // We assume a 'browser_history' table exists
    let query = supabase
      .from("browser_history")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .limit(1000)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())
    if (browserFilter !== "All") query = query.ilike("browser_name", `%${browserFilter}%`)

    // Temporary mock fallback if the table is currently empty or fails
    const { data: result, error } = await query
    
    if (result && !error) {
       setData(result as BrowserHistory[])
    } else {
       setData([])
    }
    
    setIsLoading(false)
  }, [selectedDeviceId, dateRange, browserFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter local for search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const q = searchQuery.toLowerCase()
    return data.filter(d => 
      (d.title && d.title.toLowerCase().includes(q)) || 
      (d.url && d.url.toLowerCase().includes(q))
    )
  }, [data, searchQuery])

  // Stats calc
  const stats = useMemo(() => {
    let totalVisits = 0
    const domainCounts: Record<string, number> = {}
    const dateCounts: Record<string, number> = {}

    filteredData.forEach(item => {
      const v = item.visit_count || 1
      totalVisits += v

      // Domain
      try {
        const urlObj = new URL(item.url.startsWith('http') ? item.url : `https://${item.url}`)
        const domain = urlObj.hostname.replace('www.', '')
        domainCounts[domain] = (domainCounts[domain] || 0) + v
      } catch (e) {
        // invalid URL format, use partial
        const domain = item.url.split('/')[0] || item.url
        domainCounts[domain] = (domainCounts[domain] || 0) + v
      }

      // Dates (Last 7 days logic)
      if (item.timestamp) {
        const d = parseISO(item.timestamp)
        if (isValid(d)) {
          const dateStr = format(d, 'MMM dd')
          dateCounts[dateStr] = (dateCounts[dateStr] || 0) + v
        }
      }
    })

    // Most visited
    const topDomains = Object.entries(domainCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([domain, count]) => ({ domain, count }))
      .slice(0, 5)

    // Last 7 days chart array
    const last7DaysChart = []
    const today = startOfDay(new Date())
    for (let i = 6; i >= 0; i--) {
      const d = subDays(today, i)
      const label = format(d, 'MMM dd')
      last7DaysChart.push({
        date: label,
        visits: dateCounts[label] || 0
      })
    }

    return { totalVisits, topDomains, topDomainText: topDomains[0]?.domain || "N/A", last7DaysChart }
  }, [filteredData])

  // Handle Block
  const handleBlockWebsite = async () => {
    if (!selectedItem || !selectedDeviceId) return
    setIsBlockAlertOpen(false)
    setIsSheetOpen(false)

    try {
      let domain = ""
      try {
        const u = new URL(selectedItem.url.startsWith('http') ? selectedItem.url : `https://${selectedItem.url}`)
        domain = u.hostname
      } catch {
        domain = selectedItem.url
      }

      const supabase = createClient()
      
      const { data: settings } = await supabase
        .from('device_settings')
        .select('*')
        .eq('device_id', selectedDeviceId)
        .single() as any
        
      if (settings && settings.blocked_websites) {
        const currentBlocked = Array.isArray(settings.blocked_websites) ? settings.blocked_websites : []
        if (!currentBlocked.includes(domain)) {
          await (supabase.from('device_settings') as any)
             .update({ blocked_websites: [...currentBlocked, domain] })
             .eq('device_id', selectedDeviceId)
            
          // Send remote command
          await (supabase
            .from('remote_commands') as any
          ).insert({
               device_id: selectedDeviceId,
               command_type: 'block_website',
               parameters: { target: domain },
               status: 'pending'
            })
            
          toast.success(`Successfully added ${domain} to blocklist. Device will sync shortly.`)
        } else {
          toast.info(`${domain} is already blocked.`)
        }
      } else {
        toast.error("Failed to fetch device settings. Ensure device is configured.")
      }
    } catch (e) {
      toast.error("An error occurred while blocking the website.")
    }
  }

  // Columns
  const columns: ColumnDef<BrowserHistory>[] = [
    {
      key: "favicon",
      header: "",
      width: "50px",
      render: (row) => {
        let domain = ""
        try {
          domain = new URL(row.url.startsWith('http') ? row.url : `https://${row.url}`).hostname
        } catch { domain = 'example.com' }
        return (
          <img 
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`} 
            alt="favicon" 
            className="h-5 w-5 rounded-sm object-contain bg-white"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-icon'); }}
          />
        )
      }
    },
    {
      key: "title",
      header: "Title & URL",
      render: (row) => (
        <div 
          className="flex flex-col max-w-[300px] cursor-pointer group"
          onClick={() => { setSelectedItem(row); setIsSheetOpen(true); }}
        >
          <span className="font-semibold text-sm text-blue-600 dark:text-blue-400 group-hover:underline line-clamp-1">
            {row.title || row.url}
          </span>
          <span className="text-xs text-slate-500 line-clamp-1 group-hover:text-slate-600 transition-colors">
            {row.url}
          </span>
        </div>
      )
    },
    {
      key: "browser",
      header: "Browser",
      width: "120px",
      render: (row) => (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {row.browser_name || "Chrome"}
        </span>
      )
    },
    {
      key: "visit_count",
      header: "Visits",
      width: "80px",
      render: (row) => (
         <div className="text-center w-full px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-xs font-semibold">
           {row.visit_count || 1}
         </div>
      )
    },
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
        ) : <span>—</span>
      }
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (row) => (
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={(e) => { e.stopPropagation(); setSelectedItem(row); setIsBlockAlertOpen(true); }}
          className="h-8 w-8 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
          title="Block this website"
        >
          <ShieldAlert className="h-4 w-4" />
        </Button>
      )
    }
  ]

  const exportColumns = [
    { key: "timestamp", header: "Date" },
    { key: "title", header: "Title" },
    { key: "url", header: "URL" },
    { key: "browser", header: "Browser" },
    { key: "visit_count", header: "Visits" },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🌐 Browser History" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view its browsing history.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <PageHeader
        title="🌐 Browser History"
        description="View all websites visited on the device."
        actions={
          <div className="flex items-center gap-2">
            <ExportButton data={filteredData} columns={exportColumns} filename="browser_history" />
          </div>
        }
      />

      <Card className="p-3 border shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3 items-end sm:items-center">
          <DateRangeFilter date={dateRange} setDate={setDateRange} />
          
          <Select value={browserFilter} onValueChange={(val) => setBrowserFilter(val || "All")}>
            <SelectTrigger className="w-[160px] h-9">
              <SelectValue placeholder="Browser" />
            </SelectTrigger>
            <SelectContent>
              {BROWSERS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filteredData.length > 0 && (
        <Collapsible open={statsOpen} onOpenChange={setStatsOpen} className="border rounded-xl bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
          <CollapsibleTrigger className="flex w-full items-center justify-between p-4 font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <span className="flex items-center gap-2"><Globe className="h-4 w-4 text-blue-500"/> Activity Overview</span>
            {statsOpen ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
          </CollapsibleTrigger>
          
          <CollapsibleContent className="p-4 pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              <Card className="p-4 flex flex-col justify-center bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/40">
                <span className="text-sm font-medium text-slate-500 mb-1">Total Pages Visited</span>
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{stats.totalVisits}</span>
              </Card>
              <Card className="p-4 flex flex-col justify-center bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/40">
                <span className="text-sm font-medium text-slate-500 mb-1">Most Visited Domain</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 truncate" title={stats.topDomainText}>{stats.topDomainText}</span>
              </Card>

              {/* Bar Chart */}
              <Card className="p-3 col-span-1 lg:col-span-2 shadow-none border">
                <span className="text-xs font-semibold text-slate-500 mb-2 block">Top 5 Domains</span>
                <div className="h-[80px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.topDomains} layout="vertical" margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="domain" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} width={80} />
                      <RechartsTooltip cursor={{ fill: 'transparent' }} contentStyle={{ fontSize: '12px', borderRadius: '8px' }} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <Card className="overflow-hidden border shadow-sm">
        <DataTable<BrowserHistory>
          data={filteredData}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Search title or URL..."
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
        />
      </Card>

      {/* Detail Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Visit Details</SheetTitle>
            <SheetDescription>Browser history entry details</SheetDescription>
          </SheetHeader>
          
          {selectedItem && (
            <div className="space-y-6">
              <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-xl space-y-3 border">
                <div>
                   <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Title</span>
                   <p className="font-semibold text-slate-900 dark:text-slate-100 mt-1">{selectedItem.title || "Untitled"}</p>
                </div>
                <div>
                   <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">URL</span>
                   <a href={selectedItem.url.startsWith('http') ? selectedItem.url : `https://${selectedItem.url}`} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-sm text-blue-500 hover:underline mt-1 break-all">
                     {selectedItem.url}
                     <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                   </a>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                 <div className="border rounded-lg p-3">
                   <span className="text-xs text-slate-500 block">Browser</span>
                   <span className="font-semibold">{selectedItem.browser_name || "Unknown"}</span>
                 </div>
                 <div className="border rounded-lg p-3">
                   <span className="text-xs text-slate-500 block">Visit Count</span>
                   <span className="font-semibold">{selectedItem.visit_count || 1}</span>
                 </div>
                 <div className="border rounded-lg p-3 col-span-2">
                   <span className="text-xs text-slate-500 block">Date</span>
                   <span className="font-semibold">
                     {isValid(parseISO(selectedItem.timestamp)) ? format(parseISO(selectedItem.timestamp), "PPpp") : "Unknown"}
                   </span>
                 </div>
              </div>
              
              <div className="pt-4 border-t">
                <Button 
                   variant="destructive" 
                   className="w-full gap-2"
                   onClick={() => setIsBlockAlertOpen(true)}
                >
                  <ShieldAlert className="h-4 w-4" /> Block this Website
                </Button>
                <p className="text-xs text-center text-slate-500 mt-3">
                   Blocking will send a remote command to the device to prevent access to this domain.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Block Alert Dialog */}
      <AlertDialog open={isBlockAlertOpen} onOpenChange={setIsBlockAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Website?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add the domain to the blocked websites list and send a command to the device to block further access. Are you sure you want to proceed?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockWebsite} className="bg-rose-500 hover:bg-rose-600 text-white">
               Confirm Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

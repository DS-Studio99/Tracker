"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Bookmark, ShieldAlert, AlertCircle, ExternalLink, Globe } from "lucide-react"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface BrowserBookmark {
  id: string
  device_id: string
  url: string
  title: string | null
  browser: string | null
  folder_name: string | null
  timestamp: string
}

const BROWSERS = ["All", "Chrome", "Firefox", "Samsung Internet", "Opera", "Other"]

export default function BrowserBookmarksPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [data, setData] = useState<BrowserBookmark[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [browserFilter, setBrowserFilter] = useState("All")
  const [searchQuery, setSearchQuery] = useState("")
  
  const [selectedItem, setSelectedItem] = useState<BrowserBookmark | null>(null)
  const [isBlockAlertOpen, setIsBlockAlertOpen] = useState(false)

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    // We assume a 'browser_bookmarks' table exists
    let query = supabase
      .from("browser_bookmarks")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .limit(1000)

    if (browserFilter !== "All") query = query.ilike("browser", `%${browserFilter}%`)

    const { data: result, error } = await query
    
    if (result && !error) {
       setData(result as BrowserBookmark[])
    } else {
       setData([])
    }
    
    setIsLoading(false)
  }, [selectedDeviceId, browserFilter])

  useEffect(() => { fetchData() }, [fetchData])

  // Filter local for search
  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const q = searchQuery.toLowerCase()
    return data.filter(d => 
      (d.title && d.title.toLowerCase().includes(q)) || 
      (d.url && d.url.toLowerCase().includes(q)) ||
      (d.folder_name && d.folder_name.toLowerCase().includes(q))
    )
  }, [data, searchQuery])

  // Handle Block Action
  const handleBlockWebsite = async () => {
    if (!selectedItem || !selectedDeviceId) return
    setIsBlockAlertOpen(false)

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
        .single()
        
      if (settings) {
        const currentBlocked = Array.isArray((settings as any).blocked_websites) ? (settings as any).blocked_websites : []
        if (!currentBlocked.includes(domain)) {
          await (supabase.from('device_settings') as any)
            .update({ blocked_websites: [...currentBlocked, domain] })
            .eq('device_id', selectedDeviceId)
            
          await (supabase.from('remote_commands') as any)
            .insert({
               device_id: selectedDeviceId,
               command_type: 'block_website',
               target: domain,
               status: 'pending'
            })
            
          toast.success(`Blocked ${domain} successfully. Device syncing...`)
        } else {
          toast.info(`${domain} is already blocked.`)
        }
      } else {
        toast.error("Failed to fetch device settings.")
      }
    } catch (e) {
      toast.error("An error occurred while blocking the website.")
    }
  }

  // Columns
  const columns: ColumnDef<BrowserBookmark>[] = [
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
            className="h-5 w-5 rounded-sm object-contain bg-white shrink-0"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-icon'); }}
          />
        )
      }
    },
    {
      key: "title",
      header: "Title & URL",
      render: (row) => (
        <div className="flex flex-col max-w-[350px]">
          <span className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1">
            {row.title || row.url}
          </span>
          <a 
            href={row.url.startsWith('http') ? row.url : `https://${row.url}`} 
            target="_blank" 
            rel="noreferrer" 
            className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-600 hover:underline line-clamp-1 mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Globe className="h-3 w-3 shrink-0" />
            <span className="truncate">{row.url}</span>
          </a>
        </div>
      )
    },
    {
      key: "browser",
      header: "Browser",
      width: "120px",
      render: (row) => (
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
          {row.browser || "Chrome"}
        </span>
      )
    },
    {
      key: "folder",
      header: "Folder",
      width: "140px",
      render: (row) => (
        <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-xs font-medium text-slate-600 dark:text-slate-400 truncate max-w-[120px] inline-block">
          {row.folder_name || "Bookmarks Bar"}
        </span>
      )
    },
    {
      key: "timestamp",
      header: "Date Added",
      width: "140px",
      render: (row) => {
        const d = parseISO(row.timestamp)
        return isValid(d) ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{format(d, "MMM d, yyyy")}</span>
          </div>
        ) : <span className="text-slate-400">—</span>
      }
    },
    {
      key: "actions",
      header: "",
      width: "60px",
      render: (row) => (
        <Button 
          variant="outline" 
          size="sm" 
          onClick={(e) => { e.stopPropagation(); setSelectedItem(row); setIsBlockAlertOpen(true); }}
          className="h-8 border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-900/40 dark:hover:bg-rose-950/20"
        >
          Block
        </Button>
      )
    }
  ]

  const exportColumns = [
    { key: "timestamp", header: "Date Added" },
    { key: "title", header: "Title" },
    { key: "url", header: "URL" },
    { key: "browser", header: "Browser" },
    { key: "folder_name", header: "Folder" },
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🔖 Browser Bookmarks" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view saved bookmarks.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      <PageHeader
        title="🔖 Browser Bookmarks"
        description="View all saved bookmarks and favorites."
        actions={
          <ExportButton data={filteredData} columns={exportColumns} filename="bookmarks" />
        }
      />

      <Card className="p-3 border shadow-sm flex items-center gap-3">
        <Select value={browserFilter} onValueChange={(val) => val && setBrowserFilter(val)}>
          <SelectTrigger className="w-[160px] h-9">
             <SelectValue placeholder="Browser" />
          </SelectTrigger>
          <SelectContent>
             {BROWSERS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>

      <Card className="overflow-hidden border shadow-sm">
        <DataTable
          data={filteredData}
          columns={columns}
          isLoading={isLoading}
          searchPlaceholder="Search bookmarks…"
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          emptyState={
             <div className="py-16 flex flex-col items-center text-slate-400">
                <Bookmark className="h-12 w-12 mb-3 opacity-30" />
                <p>No bookmarks found.</p>
             </div>
          }
        />
      </Card>

      {/* Block Alert Dialog */}
      <AlertDialog open={isBlockAlertOpen} onOpenChange={setIsBlockAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Block Website?</AlertDialogTitle>
            <AlertDialogDescription>
              This will add the domain to the device blocked websites list. Are you sure?
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

"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  Folder, File, Image as ImageIcon, FileText, FileSearch, Trash2, 
  Download, RefreshCw, HardDrive, Search, ChevronRight, LayoutGrid, 
  List as ListIcon, Film, Music, FileArchive, Package, Smartphone, AlertCircle
} from "lucide-react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { FileExplorerItem } from "@/lib/types/database"
import { cn } from "@/lib/utils"

function formatBytes(bytes: number | null) {
  if (bytes === null || bytes === undefined) return "—"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

const QUICK_ACCESS = [
  { name: "Root", path: "/sdcard", icon: HardDrive },
  { name: "DCIM", path: "/sdcard/DCIM", icon: ImageIcon },
  { name: "Download", path: "/sdcard/Download", icon: Download },
  { name: "Documents", path: "/sdcard/Documents", icon: FileText },
  { name: "Pictures", path: "/sdcard/Pictures", icon: ImageIcon },
  { name: "Music", path: "/sdcard/Music", icon: Music },
  { name: "Movies", path: "/sdcard/Movies", icon: Film },
  { name: "WhatsApp", path: "/sdcard/WhatsApp/Media", icon: File },
]

function getFileIcon(mimeType: string | null, fileName: string) {
  if (!mimeType) mimeType = ""
  const ext = fileName.split('.').pop()?.toLowerCase() || ""
  
  if (mimeType.startsWith("image/") || ["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) {
    return <ImageIcon className="h-full w-full text-blue-500" />
  }
  if (mimeType.startsWith("video/") || ["mp4", "mkv", "avi", "mov"].includes(ext)) {
    return <Film className="h-full w-full text-purple-500" />
  }
  if (mimeType.startsWith("audio/") || ["mp3", "wav", "ogg", "m4a"].includes(ext)) {
    return <Music className="h-full w-full text-amber-500" />
  }
  if (mimeType.includes("pdf") || ["pdf", "doc", "docx", "txt", "xls", "xlsx", "ppt"].includes(ext)) {
    return <FileText className="h-full w-full text-indigo-500" />
  }
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) {
    return <FileArchive className="h-full w-full text-rose-500" />
  }
  if (ext === "apk") {
    return <Package className="h-full w-full text-emerald-500" />
  }
  
  return <File className="h-full w-full text-slate-400" />
}

export default function FileExplorerPage() {
  const { toast } = useToast()
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<FileExplorerItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  const [currentPath, setCurrentPath] = useState("/sdcard")
  const [breadCrumbs, setBreadCrumbs] = useState<string[]>(["", "sdcard"])
  
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  
  const [selectedFile, setSelectedFile] = useState<FileExplorerItem | null>(null)
  const [isProcessingCmd, setIsProcessingCmd] = useState<string | null>(null)

  // Parse path for breadcrumbs
  useEffect(() => {
    if (!isSearching) {
      const parts = currentPath.split("/").filter(Boolean)
      setBreadCrumbs(["", ...parts]) // empty string represents root slash
    }
  }, [currentPath, isSearching])

  const navigateToPath = (path: string) => {
    setIsSearching(false)
    setSearchQuery("")
    setCurrentPath(path.endsWith("/") && path.length > 1 ? path.slice(0, -1) : path)
  }

  const navigateBreadcrumb = (index: number) => {
    if (index === 0) {
      navigateToPath("/")
      return
    }
    const targetPath = breadCrumbs.slice(0, index + 1).join("/")
    navigateToPath(targetPath)
  }

  const navigateUp = () => {
    if (currentPath === "/" || currentPath === "") return
    const parts = currentPath.split("/").filter(Boolean)
    parts.pop()
    navigateToPath("/" + parts.join("/"))
  }

  const fetchFiles = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    let query = supabase.from("file_explorer").select("*").eq("device_id", selectedDeviceId)

    if (searchQuery.trim()) {
      setIsSearching(true)
      query = query.ilike("file_name", `%${searchQuery}%`).limit(200)
    } else {
      setIsSearching(false)
      // The tracking app usually stores paths consistently
      query = query.or(`parent_path.eq.${currentPath},parent_path.eq.${currentPath}/`)
      query = query.order("is_directory", { ascending: false }).order("file_name", { ascending: true })
    }

    const { data: result } = await query
    setData((result as FileExplorerItem[]) || [])
    setIsLoading(false)
  }, [selectedDeviceId, currentPath, searchQuery])

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchFiles()
    }, searchQuery ? 500 : 0)
    return () => clearTimeout(delayDebounceFn)
  }, [fetchFiles])

  // Actions
  const handleRefresh = async () => {
    if (!selectedDeviceId) return
    setIsRefreshing(true)
    const supabase = createClient()
    
    try {
      await supabase.from("remote_commands").insert({
        device_id: selectedDeviceId,
        command_type: "restart_service",
        parameters: { target: "file_explorer_sync", path: currentPath },
        status: "pending"
      } as any)
      
      toast({
        title: "Scan Requested",
        description: "A command has been sent to rescan files. Refresh the page in a few moments.",
      })
    } catch (e) {
      toast({ title: "Error", description: "Failed to send scan request.", variant: "destructive" })
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDownload = async (file: FileExplorerItem) => {
    if (file.download_url) {
      window.open(file.download_url, "_blank")
      return
    }

    if (!selectedDeviceId) return
    setIsProcessingCmd("download")
    const supabase = createClient()
    
    try {
      await supabase.from("remote_commands").insert({
        device_id: selectedDeviceId,
        command_type: "download_file",
        parameters: { file_path: file.file_path },
        status: "pending"
      } as any)
      
      toast({
        title: "Download Requested",
        description: "Command sent to device. Once uploaded, the download link will appear here.",
      })
      setSelectedFile(null)
    } catch (e) {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" })
    } finally {
      setIsProcessingCmd(null)
    }
  }

  const handleDelete = async (file: FileExplorerItem) => {
    if (!confirm(`Are you sure you want to permanently delete '${file.file_name}' from the device?`)) return
    
    if (!selectedDeviceId) return
    setIsProcessingCmd("delete")
    const supabase = createClient()
    
    try {
      await supabase.from("remote_commands").insert({
        device_id: selectedDeviceId,
        command_type: "delete_file",
        parameters: { file_path: file.file_path },
        status: "pending"
      } as any)
      
      toast({
        title: "Deletion Requested",
        description: "Command sent to seamlessly delete the file.",
      })
      setSelectedFile(null)
    } catch (e) {
      toast({ title: "Error", description: "Request failed.", variant: "destructive" })
    } finally {
      setIsProcessingCmd(null)
    }
  }

  const listColumns: ColumnDef<FileExplorerItem>[] = [
    {
      key: "file_name",
      header: "Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 shrink-0 relative flex items-center justify-center bg-slate-100 dark:bg-slate-800 rounded">
             {row.is_directory 
               ? <Folder className="h-5 w-5 fill-amber-400 text-amber-500" /> 
               : (row.mime_type?.startsWith('image/') && row.download_url) 
                   ? <img src={row.download_url} alt="" className="h-full w-full object-cover rounded" /> 
                   : <div className="h-5 w-5">{getFileIcon(row.mime_type, row.file_name)}</div>
             }
          </div>
          <div className="flex flex-col min-w-0">
             <span className="font-medium text-sm text-slate-900 dark:text-slate-100 truncate">{row.file_name}</span>
             {isSearching && <span className="text-[10px] text-slate-500 truncate">{row.parent_path}</span>}
          </div>
        </div>
      )
    },
    {
      key: "file_type",
      header: "Type",
      render: (row) => (
        <Badge variant={row.is_directory ? "secondary" : "outline"} className="text-[10px] uppercase font-mono bg-slate-50 dark:bg-slate-900 border-none font-medium">
          {row.is_directory ? "FOLDER" : (row.file_type || (row.file_name.split('.').pop()) || "FILE").toUpperCase()}
        </Badge>
      )
    },
    {
      key: "file_size",
      header: "Size",
      render: (row) => <span className="text-sm text-slate-500 whitespace-nowrap">{row.is_directory ? "—" : formatBytes(row.file_size)}</span>
    },
    {
      key: "last_modified",
      header: "Last Modified",
      render: (row) => (
        <span className="text-sm text-slate-500 whitespace-nowrap">
           {row.last_modified && isValid(parseISO(row.last_modified)) 
             ? format(parseISO(row.last_modified), "MMM d, yyyy h:mm a") 
             : "Unknown"}
        </span>
      )
    }
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📁 File Explorer" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <HardDrive className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to browse its internal storage.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20 flex flex-col h-full lg:h-[calc(100vh-100px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
        <PageHeader
          title="📁 File Explorer"
          description="Browse and manage files remotely on the device storage."
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="bg-white dark:bg-slate-950">
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} /> 
            {isRefreshing ? "Scanning..." : "Sync Files"}
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[500px] mt-2">
        {/* Sidebar */}
        <Card className="w-full lg:w-[220px] shrink-0 border shadow-sm flex flex-col overflow-hidden h-fit lg:h-full">
          <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider pl-1">Quick Access</h4>
          </div>
          <ScrollArea className="flex-1 lg:max-h-full">
            <div className="p-2 space-y-1">
              {QUICK_ACCESS.map((item, i) => {
                const isActive = !isSearching && currentPath.startsWith(item.path) && (item.path !== "/sdcard" || currentPath === "/sdcard")
                const Icon = item.icon
                return (
                  <button
                    key={i}
                    onClick={() => navigateToPath(item.path)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive 
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")} />
                    {item.name}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </Card>

        {/* Main Explorer Area */}
        <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm">
          {/* Breadcrumbs & Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 gap-3">
             <div className="flex items-center flex-wrap flex-1 gap-1 text-sm font-medium pr-4 w-full sm:w-auto">
               {isSearching ? (
                 <span className="text-slate-600 dark:text-slate-300 flex items-center gap-2">
                   <FileSearch className="h-4 w-4" /> Search Results for "{searchQuery}"
                 </span>
               ) : (
                 breadCrumbs.map((part, index) => (
                   <div key={index} className="flex items-center">
                     {index > 0 && <ChevronRight className="h-4 w-4 text-slate-400 mx-0.5" />}
                     <button 
                       onClick={() => navigateBreadcrumb(index)}
                       className={cn(
                         "hover:bg-slate-200 dark:hover:bg-slate-800 px-1.5 py-0.5 rounded transition-colors truncate max-w-[120px] sm:max-w-[200px]",
                         index === breadCrumbs.length - 1 ? "text-indigo-600 dark:text-indigo-400 font-bold" : "text-slate-600 dark:text-slate-400"
                       )}
                     >
                       {part === "" ? <HardDrive className="h-4 w-4" /> : part}
                     </button>
                   </div>
                 ))
               )}
             </div>

             <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-48">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    placeholder="Search files..."
                    className="pl-8 h-8 text-xs w-full"
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded p-0.5 shrink-0">
                  <Button size="icon" variant={viewMode === "grid" ? "default" : "ghost"} className="h-7 w-7 rounded-sm" onClick={() => setViewMode("grid")}>
                    <LayoutGrid className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant={viewMode === "list" ? "default" : "ghost"} className="h-7 w-7 rounded-sm" onClick={() => setViewMode("list")}>
                    <ListIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
             </div>
          </div>

          <div className="flex-1 bg-white dark:bg-slate-950 flex flex-col relative min-h-0">
             {isLoading ? (
               <div className="p-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                 {Array.from({length: 10}).map((_, i) => (
                   <div key={i} className="flex flex-col items-center gap-2">
                     <Skeleton className="h-16 w-16 rounded-xl" />
                     <Skeleton className="h-3 w-3/4" />
                   </div>
                 ))}
               </div>
             ) : data.length === 0 ? (
               <div className="flex flex-col items-center justify-center p-8 text-slate-400 h-full w-full absolute inset-0">
                 {isSearching ? (
                    <>
                      <FileSearch className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm font-medium">No files found matching "{searchQuery}"</p>
                    </>
                 ) : (
                    <>
                      <Folder className="h-12 w-12 mb-3 opacity-20" />
                      <p className="text-sm font-medium">This folder is empty</p>
                      <p className="text-xs mt-1 text-center max-w-[250px]">
                        No data uploaded for this path yet. Try clicking Sync Files.
                      </p>
                    </>
                 )}
               </div>
             ) : viewMode === "grid" ? (
               <ScrollArea className="flex-1 h-full w-full absolute inset-0">
                 <div className="p-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-4 pb-8">
                    {/* Render Folders First */}
                    {data.filter(f => f.is_directory).map(folder => (
                      <button
                        key={folder.id}
                        onDoubleClick={() => navigateToPath(folder.file_path)}
                        onClick={() => {
                          // Mobile user single taps to open
                          if (window.innerWidth < 1024) navigateToPath(folder.file_path)
                          else setSelectedFile(folder)
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-xl transition-all border border-transparent outline-none group",
                          selectedFile?.id === folder.id 
                            ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800/50" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        )}
                      >
                         <div className="relative">
                           <Folder className="h-14 w-14 lg:h-16 lg:w-16 fill-amber-300 text-amber-500 drop-shadow-sm group-hover:scale-105 transition-transform" />
                         </div>
                         <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate w-full text-center group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{folder.file_name}</span>
                      </button>
                    ))}

                    {/* Render Files */}
                    {data.filter(f => !f.is_directory).map(file => (
                      <button
                        key={file.id}
                        onClick={() => setSelectedFile(file)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-xl transition-all border border-transparent outline-none group",
                          selectedFile?.id === file.id 
                            ? "bg-indigo-50 border-indigo-200 dark:bg-indigo-900/30 dark:border-indigo-800/50" 
                            : "hover:bg-slate-50 dark:hover:bg-slate-900/50"
                        )}
                      >
                         <div className="relative h-14 w-14 lg:h-16 lg:w-16 flex items-center justify-center rounded-lg overflow-hidden group-hover:scale-105 transition-transform bg-slate-100 dark:bg-slate-800 shadow-sm border border-slate-200 dark:border-slate-700/50">
                           {(file.mime_type?.startsWith('image/') && file.download_url) ? (
                              <img src={file.download_url} alt={file.file_name} className="h-full w-full object-cover" loading="lazy" />
                           ) : (
                              <div className="h-8 w-8">{getFileIcon(file.mime_type, file.file_name)}</div>
                           )}
                         </div>
                         <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300 truncate w-full text-center leading-tight">
                           {file.file_name}
                         </span>
                      </button>
                    ))}
                 </div>
               </ScrollArea>
             ) : (
               <div className="absolute inset-0 overflow-auto">
                 <DataTable<FileExplorerItem>
                    data={data}
                    columns={listColumns}
                    isLoading={false}
                    onRowClick={setSelectedFile}
                    searchable={false}
                 />
               </div>
             )}
          </div>
        </Card>
      </div>

      {/* ── DETAIL SHEET ── */}
      <Sheet open={!!selectedFile} onOpenChange={(o) => !o && setSelectedFile(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedFile && (
            <div className="py-4 h-full flex flex-col">
              <SheetHeader className="pb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col items-center text-center">
                 <div className="h-24 w-24 shrink-0 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center overflow-hidden border shadow-inner mb-4 mt-2 relative group">
                   {selectedFile.is_directory ? (
                     <Folder className="h-16 w-16 fill-amber-400 text-amber-500" />
                   ) : (selectedFile.mime_type?.startsWith('image/') && selectedFile.download_url) ? (
                     <img src={selectedFile.download_url} alt={selectedFile.file_name} className="h-full w-full object-cover" />
                   ) : (
                     <div className="h-12 w-12">{getFileIcon(selectedFile.mime_type, selectedFile.file_name)}</div>
                   )}
                 </div>
                 
                 <SheetTitle className="text-lg font-bold w-full break-all leading-snug">
                   {selectedFile.file_name}
                 </SheetTitle>
                 
                 <div className="flex flex-wrap gap-2 justify-center mt-2">
                   <Badge variant={selectedFile.is_directory ? "secondary" : "outline"} className="text-[10px] uppercase font-mono border-slate-300">
                     {selectedFile.is_directory ? "FOLDER" : (selectedFile.file_type || (selectedFile.file_name.split('.').pop()) || "FILE").toUpperCase()}
                   </Badge>
                   {!selectedFile.is_directory && (
                     <Badge variant="secondary" className="text-[10px] font-mono bg-slate-100 dark:bg-slate-800">
                       {formatBytes(selectedFile.file_size)}
                     </Badge>
                   )}
                 </div>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Info Block */}
                <div>
                   <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 pl-1">File Information</h4>
                   <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-slate-50 dark:bg-slate-900 text-sm">
                     <div className="flex justify-between p-3 gap-4">
                       <span className="text-slate-500 shrink-0">Path</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate" title={selectedFile.file_path}>
                         {selectedFile.file_path}
                       </span>
                     </div>
                     {!selectedFile.is_directory && selectedFile.mime_type && (
                       <div className="flex justify-between p-3 gap-4">
                         <span className="text-slate-500 shrink-0">MIME Type</span>
                         <span className="font-medium text-slate-800 dark:text-slate-200 text-right truncate">
                           {selectedFile.mime_type}
                         </span>
                       </div>
                     )}
                     <div className="flex justify-between p-3 gap-4">
                       <span className="text-slate-500 shrink-0">Modified</span>
                       <span className="font-medium text-slate-800 dark:text-slate-200 text-right">
                         {selectedFile.last_modified && isValid(parseISO(selectedFile.last_modified)) ? format(parseISO(selectedFile.last_modified), "PPpp") : "Unknown"}
                       </span>
                     </div>
                   </div>
                </div>

                {/* Inline Preview if URL exists */}
                {!selectedFile.is_directory && selectedFile.download_url && (
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 pl-1">Preview</h4>
                    <div className="border rounded-lg overflow-hidden bg-black flex items-center justify-center max-h-[300px]">
                      {selectedFile.mime_type?.startsWith("image/") && (
                        <img src={selectedFile.download_url} alt="" className="max-h-[300px] object-contain" />
                      )}
                      {selectedFile.mime_type?.startsWith("video/") && (
                        <video src={selectedFile.download_url} controls className="max-h-[300px] w-full" />
                      )}
                      {selectedFile.mime_type?.startsWith("audio/") && (
                        <audio src={selectedFile.download_url} controls className="w-full m-4" />
                      )}
                      {!selectedFile.mime_type?.startsWith("image/") && !selectedFile.mime_type?.startsWith("video/") && !selectedFile.mime_type?.startsWith("audio/") && (
                        <div className="p-8 text-center text-slate-400">
                          <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">Preview not available for this file type</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Navigation Context Action */}
                {selectedFile.is_directory && (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      navigateToPath(selectedFile.file_path)
                      setSelectedFile(null)
                    }}
                  >
                    Open Folder <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}
              </div>
              
              {/* Footer Actions */}
              {!selectedFile.is_directory && (
                <div className="pt-6 mt-auto shrink-0 flex flex-col gap-3">
                  {selectedFile.download_url ? (
                    <Button 
                      className="w-full gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                      onClick={() => handleDownload(selectedFile)}
                    >
                      <Download className="h-4 w-4" /> Download File Now
                    </Button>
                  ) : (
                    <Button 
                      variant="outline"
                      className="w-full gap-2 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                      onClick={() => handleDownload(selectedFile)}
                      disabled={isProcessingCmd === "download"}
                    >
                      <Download className="h-4 w-4" /> {isProcessingCmd === "download" ? "Requesting..." : "Request Download from Device"}
                    </Button>
                  )}
                  
                  <Button 
                    variant="ghost" 
                    className="w-full gap-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950"
                    onClick={() => handleDelete(selectedFile)}
                    disabled={isProcessingCmd === "delete"}
                  >
                    <Trash2 className="h-4 w-4" /> {isProcessingCmd === "delete" ? "Sending Request..." : "Delete Permanently"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

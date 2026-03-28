"use client"

import { useEffect, useState, useMemo } from "react"
import { format } from "date-fns"
import { 
  Camera, 
  FileImage, 
  Film, 
  Grid2X2, 
  List, 
  Download, 
  AlertCircle,
  PlayCircle,
  CheckCircle2,
  HardDrive
} from "lucide-react"
import { DateRange } from "react-day-picker"

import { createClient } from "@/lib/supabase/client"
import { useDeviceStore } from "@/lib/stores/device-store"
import { useDeviceData } from "@/lib/hooks/use-device-data"
import { MediaFile } from "@/lib/types/database"
import { formatFileSize, formatDuration } from "@/lib/utils/format"

import { PageHeader } from "@/components/shared/page-header"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { MediaLightbox } from "@/components/shared/media-lightbox"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export default function MediaGalleryPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  // Filters & State
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [fileType, setFileType] = useState('all')
  const [source, setSource] = useState('all')
  const [sortBy, setSortBy] = useState<'desc' | 'asc'>('desc')
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  
  // Selection & Lightbox
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  
  // Pagination
  const [page, setPage] = useState(0)
  const pageSize = 24

  const filters = useMemo(() => {
    const f: Record<string, any> = { is_deleted: false }
    if (fileType !== 'all') f.file_type = fileType
    if (source !== 'all') f.source = source
    return f
  }, [fileType, source])

  const { data: mediaItems, count, isLoading, setPage: handlePageChange } = useDeviceData<MediaFile>('media_files', {
    pageSize,
    orderBy: 'file_timestamp',
    orderDirection: sortBy,
    filters,
    dateColumn: 'file_timestamp',
    dateRange
  })

  // Reset page when filters change
  useEffect(() => {
    handlePageChange(0)
    setPage(0)
    setSelectedIds(new Set())
  }, [selectedDeviceId, fileType, source, sortBy, dateRange, handlePageChange])

  useEffect(() => {
    setPage(0)
  }, [page]) // keep sync

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setSelectedIds(newSet)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === mediaItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(mediaItems.map(m => m.id)))
    }
  }

  const handleBatchDownload = async () => {
    if (selectedIds.size === 0) return
    toast.info(`Starting download of ${selectedIds.size} items...`)
    
    // In a real implementation this might trigger a server-side zip creation
    // For now, download files individually sequentially to not crash the browser
    const itemsToDownload = mediaItems.filter(m => selectedIds.has(m.id))
    
    for (const item of itemsToDownload) {
      try {
        const response = await fetch(item.file_url)
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = item.file_name || `download_${item.id}`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        await new Promise(r => setTimeout(r, 500)) // slight delay
      } catch (error) {
        toast.error(`Failed to download: ${item.file_name}`)
      }
    }
    toast.success("Download complete")
    setSelectedIds(new Set())
  }

  const columns: ColumnDef<MediaFile>[] = [
    {
      key: "select",
      header: "Select",
      width: "40px",
      render: (row) => (
        <Checkbox 
          checked={selectedIds.has(row.id)}
          onCheckedChange={() => toggleSelection(row.id)}
          aria-label={`Select ${row.file_name}`}
        />
      )
    },
    {
      key: "thumbnail",
      header: "Thumb",
      width: "80px",
      render: (row) => (
        <div 
          className="h-12 w-12 rounded object-cover overflow-hidden bg-slate-100 dark:bg-slate-800 cursor-pointer relative"
          onClick={() => setLightboxIndex(mediaItems.findIndex(m => m.id === row.id))}
        >
          <img src={row.thumbnail_url || row.file_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          {row.file_type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <PlayCircle className="h-5 w-5 text-white opacity-80" />
            </div>
          )}
        </div>
      )
    },
    {
      key: "file_name",
      header: "File Name",
      render: (row) => (
        <div className="flex flex-col">
          <span 
            className="font-medium text-blue-600 hover:underline cursor-pointer truncate max-w-[200px]"
            onClick={() => setLightboxIndex(mediaItems.findIndex(m => m.id === row.id))}
          >
            {row.file_name || 'Unnamed media'}
          </span>
          <span className="text-xs text-slate-500 capitalize">{row.file_type} • {row.source || 'Unknown source'}</span>
        </div>
      )
    },
    {
      key: "size",
      header: "Size",
      width: "100px",
      render: (row) => <span className="text-sm">{row.file_size ? formatFileSize(row.file_size) : '--'}</span>
    },
    {
      key: "date",
      header: "Date/Time",
      width: "160px",
      render: (row) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium">{format(new Date(row.file_timestamp || row.created_at), "MMM d, yyyy")}</span>
          <span className="text-xs text-slate-500">{format(new Date(row.file_timestamp || row.created_at), "h:mm a")}</span>
        </div>
      )
    }
  ]

  if (!selectedDeviceId) {
    return (
       <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="Photos & Videos" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">
            Please go to the dashboard or devices page and select a device to view its media gallery.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full space-y-6 pb-20 animate-in fade-in h-full flex flex-col">
      <PageHeader 
        title="Photos & Videos" 
        description="View all photos taken and videos recorded on the device"
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="p-3 shadow-sm border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Tabs value={fileType} onValueChange={setFileType} className="w-auto">
              <TabsList className="h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="photo" className="text-xs"><FileImage className="h-3.5 w-3.5 mr-1" /> Photos</TabsTrigger>
                <TabsTrigger value="video" className="text-xs"><Film className="h-3.5 w-3.5 mr-1" /> Videos</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Select value={source} onValueChange={(val) => val && setSource(val)}>
              <SelectTrigger className="w-[140px] h-9 text-xs font-medium">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                <SelectItem value="camera">Camera</SelectItem>
                <SelectItem value="download">Downloads</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="screenshot">Screenshots</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(val) => val && setSortBy(val as 'desc'|'asc')}>
              <SelectTrigger className="w-[140px] h-9 text-xs font-medium">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Newest First</SelectItem>
                <SelectItem value="asc">Oldest First</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <Button onClick={handleBatchDownload} size="sm" variant="default" className="h-9">
                <Download className="h-4 w-4 mr-2" /> Download ({selectedIds.size})
              </Button>
            )}
            
            <div className="border rounded-md flex items-center p-0.5 bg-slate-100 dark:bg-slate-900 ml-auto">
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 rounded-sm", viewMode === 'grid' && "bg-white dark:bg-slate-800 shadow-sm")}
                onClick={() => setViewMode('grid')}
              >
                <Grid2X2 className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8 rounded-sm", viewMode === 'list' && "bg-white dark:bg-slate-800 shadow-sm")}
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Gallery Content */}
      {mediaItems.length === 0 && !isLoading ? (
        <Card className="flex flex-col items-center justify-center p-16 text-center border-dashed text-slate-500">
          <Camera className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 mb-2">No photos or videos found</h3>
          <p className="max-w-sm text-sm">
            Try adjusting your filters or date range. Wait for the device to sync new media files.
          </p>
        </Card>
      ) : (
        <>
          {viewMode === 'list' ? (
            <Card className="p-0 overflow-hidden shadow-sm">
               <DataTable 
                 data={mediaItems}
                 columns={columns}
                 isLoading={isLoading}
                 page={page}
                 totalCount={count}
                 pageSize={pageSize}
                 onPageChange={(p) => { setPage(p); handlePageChange(p); }}
               />
            </Card>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {mediaItems.map((item, index) => {
                  const isSelected = selectedIds.has(item.id)
                  
                  return (
                    <Card 
                      key={item.id} 
                      className={cn(
                        "group relative aspect-square overflow-hidden border-2 cursor-pointer transition-all",
                        isSelected ? "border-blue-500 shadow-sm" : "border-transparent hover:border-slate-300 dark:hover:border-slate-700"
                      )}
                      onClick={() => setLightboxIndex(index)}
                    >
                      <img 
                        src={item.thumbnail_url || item.file_url} 
                        alt={item.file_name || "Media"} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        loading="lazy"
                      />
                      
                      {/* Gradient overlay for text visibility */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                      
                      {/* Selection Checkbox */}
                      <div 
                        className={cn(
                          "absolute top-2 right-2 z-10",
                          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => { e.stopPropagation(); toggleSelection(item.id); }}
                      >
                        {isSelected ? (
                          <div className="bg-blue-500 rounded-full text-white border border-white">
                            <CheckCircle2 className="h-6 w-6" />
                          </div>
                        ) : (
                          <div className="h-6 w-6 rounded-full border-2 border-white/70 bg-black/20 hover:bg-black/40 backdrop-blur-sm" />
                        )}
                      </div>
                      
                      {/* Top Left Badge */}
                      <div className="absolute top-2 left-2 flex gap-1 z-10">
                        <Badge variant="secondary" className="bg-black/50 hover:bg-black/60 text-white border-none py-0.5 px-1.5 h-auto text-[10px] backdrop-blur-sm shadow-sm pointer-events-none">
                          {item.file_type === 'video' ? <Film className="h-3 w-3 mr-1" /> : <FileImage className="h-3 w-3 mr-1" />}
                          <span className="capitalize">{item.source || 'Unknown'}</span>
                        </Badge>
                      </div>
                      
                      {/* Video Center Play Icon */}
                      {item.file_type === 'video' && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <div className="bg-black/40 p-3 rounded-full backdrop-blur-sm border border-white/20 shadow-lg group-hover:bg-black/60 group-hover:scale-110 transition-all">
                            <PlayCircle className="h-8 w-8 text-white opacity-90" />
                          </div>
                        </div>
                      )}
                      
                      {/* Bottom Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-end text-white text-[10px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <span className="font-medium truncate mr-2 drop-shadow-md bg-black/40 px-1.5 py-0.5 rounded backdrop-blur-sm">
                          {format(new Date(item.file_timestamp || item.created_at), "MMM d • h:mm a")}
                        </span>
                        
                        {(item.file_type === 'video' && item.duration) ? (
                          <span className="font-mono bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm shrink-0 shadow-sm border border-white/10">
                            {formatDuration(item.duration)}
                          </span>
                        ) : (
                          <span className="font-medium bg-black/60 px-1.5 py-0.5 rounded backdrop-blur-sm shrink-0 shadow-sm border border-white/10 flex items-center gap-1">
                            <HardDrive className="h-2.5 w-2.5" />
                            {item.file_size ? formatFileSize(item.file_size) : '--'}
                          </span>
                        )}
                      </div>
                    </Card>
                  )
                })}
              </div>
              
              {/* Pagination Controls for Grid View */}
              <div className="flex items-center justify-between border-t pt-4 mt-8 px-2">
                <div className="text-sm text-slate-500">
                  Showing {(page * pageSize) + 1} to {Math.min((page + 1) * pageSize, count)} of {count} photos
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setPage(page - 1); handlePageChange(page - 1); }}
                    disabled={page === 0 || isLoading}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => { setPage(page + 1); handlePageChange(page + 1); }}
                    disabled={(page + 1) * pageSize >= count || isLoading}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Lightbox Modal */}
      <MediaLightbox 
        isOpen={lightboxIndex !== null}
        items={mediaItems}
        currentIndex={lightboxIndex || 0}
        onClose={() => setLightboxIndex(null)}
        onNavigate={setLightboxIndex}
      />
    </div>
  )
}

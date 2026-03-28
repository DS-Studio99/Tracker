"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  Camera, Download, X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
  Maximize2, Monitor, Video, Play, RefreshCw, AlertCircle
} from "lucide-react"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { toast } from "sonner"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { ScreenCapture } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 24

function formatBytes(bytes: number | null) {
  if (!bytes) return "Unknown size"
  if (bytes === 0) return "0 B"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatDuration(secs: number | null) {
  if (!secs) return null
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ── Lightbox component ──────────────────────────────────────────
function Lightbox({ items, initialIndex, onClose }: {
  items: ScreenCapture[]
  initialIndex: number
  onClose: () => void
}) {
  const [idx, setIdx] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)
  const current = items[idx]

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowRight") setIdx(i => Math.min(i + 1, items.length - 1))
      if (e.key === "ArrowLeft") setIdx(i => Math.max(i - 1, 0))
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [items.length, onClose])

  useEffect(() => setZoom(1), [idx])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div
        className="absolute top-0 inset-x-0 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm z-10"
        onClick={e => e.stopPropagation()}
      >
        <span className="text-white/70 text-sm font-mono">
          {idx + 1} / {items.length}
        </span>
        <span className="text-white text-sm font-medium truncate max-w-[60%] text-center">
          {current?.timestamp && isValid(parseISO(current.timestamp)) && format(parseISO(current.timestamp), "MMM d, yyyy  h:mm:ss a")}
        </span>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" className="text-white/70 hover:text-white h-8 w-8" onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-white/60 text-xs w-8 text-center">{(zoom * 100).toFixed(0)}%</span>
          <Button size="icon" variant="ghost" className="text-white/70 hover:text-white h-8 w-8" onClick={() => setZoom(z => Math.min(z + 0.25, 3))}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <a href={current?.file_url} download target="_blank" rel="noreferrer">
            <Button size="icon" variant="ghost" className="text-white/70 hover:text-white h-8 w-8">
              <Download className="h-4 w-4" />
            </Button>
          </a>
          <Button size="icon" variant="ghost" className="text-white/70 hover:text-white h-8 w-8" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Image */}
      <div className="flex-1 flex items-center justify-center w-full overflow-hidden" onClick={e => e.stopPropagation()}>
        {current?.capture_type === "screenshot" ? (
          <img
            src={current.file_url}
            alt="Screenshot"
            className="max-w-full max-h-full object-contain select-none transition-transform"
            style={{ transform: `scale(${zoom})` }}
            draggable={false}
          />
        ) : (
          <video
            src={current?.file_url}
            controls
            className="max-w-full max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          />
        )}
      </div>

      {/* Prev/Next */}
      {idx > 0 && (
        <button
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
          onClick={e => { e.stopPropagation(); setIdx(i => i - 1) }}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}
      {idx < items.length - 1 && (
        <button
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-all"
          onClick={e => { e.stopPropagation(); setIdx(i => i + 1) }}
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function ScreenshotsPage() {

  const { selectedDeviceId } = useDeviceStore()

  const [screenshots, setScreenshots] = useState<ScreenCapture[]>([])
  const [recordings, setRecordings] = useState<ScreenCapture[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [ssPage, setSsPage] = useState(0)
  const [recPage, setRecPage] = useState(0)
  const [hasMoreSs, setHasMoreSs] = useState(true)
  const [hasMoreRec, setHasMoreRec] = useState(true)

  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  const [lightboxItems, setLightboxItems] = useState<ScreenCapture[] | null>(null)
  const [lightboxIdx, setLightboxIdx] = useState(0)

  const [isTaking, setIsTaking] = useState(false)
  const [captureStatus, setCaptureStatus] = useState("")
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (type: "screenshot" | "screen_recording", page: number) => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    if (page === 0) setIsLoading(true)

    let query = supabase
      .from("screen_captures")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .eq("capture_type", type)
      .order("timestamp", { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", new Date(dateRange.to.getTime() + 86400000).toISOString())

    const { data: result } = await query
    const rows = (result as ScreenCapture[]) || []

    if (type === "screenshot") {
      setScreenshots(prev => page === 0 ? rows : [...prev, ...rows])
      setHasMoreSs(rows.length === PAGE_SIZE)
    } else {
      setRecordings(prev => page === 0 ? rows : [...prev, ...rows])
      setHasMoreRec(rows.length === PAGE_SIZE)
    }

    if (page === 0) setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => {
    setSsPage(0)
    setRecPage(0)
    setScreenshots([])
    setRecordings([])
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchData("screenshot", ssPage) }, [fetchData, ssPage])
  useEffect(() => { fetchData("screen_recording", recPage) }, [fetchData, recPage])

  const handleTakeScreenshot = async () => {
    if (!selectedDeviceId) return
    setIsTaking(true)
    setCaptureStatus("Sending capture command...")
    const supabase = createClient()

    const { data: cmd, error } = await supabase
      .from("remote_commands")
      .insert({
        device_id: selectedDeviceId,
        command_type: "take_screenshot",
        parameters: {},
        status: "pending"
      } as any)
      .select()
      .single() as any

    if (error || !cmd) {
      toast.error("Could not send screenshot command.")
      setIsTaking(false)
      return
    }

    setCaptureStatus("Waiting for device to capture...")

    // Subscribe to realtime updates on this command
    const channel = supabase
      .channel(`cmd-${cmd.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "remote_commands",
        filter: `id=eq.${cmd.id}`
      }, (payload) => {
        const updated = payload.new as any
        if (updated.status === "executed") {
          channel.unsubscribe()
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setIsTaking(false)
          setCaptureStatus("")
          toast.success("📸 Screenshot Captured! Refreshing gallery...")
          setSsPage(0)
          fetchData("screenshot", 0)
        } else if (updated.status === "failed") {
          channel.unsubscribe()
          if (timeoutRef.current) clearTimeout(timeoutRef.current)
          setIsTaking(false)
          setCaptureStatus("")
          toast.error("Screenshot Failed: Device reported a failure.")
        }
      })
      .subscribe()

    // 30-second timeout fallback
    timeoutRef.current = setTimeout(() => {
      channel.unsubscribe()
      setIsTaking(false)
      setCaptureStatus("")
      toast.error("Timed Out: No response from device after 30 seconds.")
    }, 30000)
  }

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📸 Screenshots & Recordings" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Monitor className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view captured screenshots and recordings.</p>
        </Card>
      </div>
    )
  }

  return (
    <>
      {lightboxItems && (
        <Lightbox
          items={lightboxItems}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxItems(null)}
        />
      )}

      <div className="space-y-4 animate-in fade-in pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <PageHeader
            title="📸 Screenshots & Screen Recordings"
            description="Captured screens and screen recordings from the device."
          />
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
            <Button
              onClick={handleTakeScreenshot}
              disabled={isTaking}
              className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 whitespace-nowrap"
            >
              {isTaking ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> {captureStatus || "Capturing..."}</>
              ) : (
                <><Camera className="h-4 w-4" /> Take Screenshot Now</>
              )}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="screenshots">
          <TabsList className="mb-4">
            <TabsTrigger value="screenshots" className="gap-2">
              <Monitor className="h-4 w-4" /> Screenshots
              <Badge variant="secondary" className="ml-1">{screenshots.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="recordings" className="gap-2">
              <Video className="h-4 w-4" /> Screen Recordings
              <Badge variant="secondary" className="ml-1">{recordings.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* ── SCREENSHOTS TAB ── */}
          <TabsContent value="screenshots">
            {isLoading && screenshots.length === 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[9/16] rounded-xl" />
                ))}
              </div>
            ) : screenshots.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-20 border-dashed">
                <Monitor className="h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">No screenshots captured yet.</p>
                <p className="text-xs text-slate-400 mt-1">Use the "Take Screenshot Now" button to capture one remotely.</p>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 lg:gap-4">
                  {screenshots.map((ss, idx) => (
                    <div
                      key={ss.id}
                      className="group relative aspect-[9/16] rounded-xl overflow-hidden cursor-pointer border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md hover:scale-[1.02] transition-all bg-slate-100 dark:bg-slate-900"
                      onClick={() => { setLightboxItems(screenshots); setLightboxIdx(idx) }}
                    >
                      <img
                        src={ss.thumbnail_url || ss.file_url}
                        alt="Screenshot"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                        <p className="text-white text-[11px] font-medium">
                          {ss.timestamp && isValid(parseISO(ss.timestamp)) && format(parseISO(ss.timestamp), "MMM d, h:mm a")}
                        </p>
                        <p className="text-white/70 text-[10px]">{formatBytes(ss.file_size)}</p>
                      </div>

                      {/* Timestamp bottom badge — always visible */}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-2 group-hover:opacity-0 transition-opacity">
                        <p className="text-white text-[10px] leading-tight">
                          {ss.timestamp && isValid(parseISO(ss.timestamp)) && format(parseISO(ss.timestamp), "MMM d, h:mm a")}
                        </p>
                      </div>

                      {/* Expand Icon */}
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-black/50 rounded-full p-1.5">
                          <Maximize2 className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>

                      {/* Download */}
                      <a
                        href={ss.file_url}
                        download
                        target="_blank"
                        rel="noopener noreferrer"
                        className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={e => e.stopPropagation()}
                      >
                        <div className="bg-black/50 rounded-full p-1.5 hover:bg-black/80 transition-colors">
                          <Download className="h-3.5 w-3.5 text-white" />
                        </div>
                      </a>
                    </div>
                  ))}
                </div>
                {hasMoreSs && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" onClick={() => setSsPage(p => p + 1)} disabled={isLoading}>
                      Load More Screenshots
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── RECORDINGS TAB ── */}
          <TabsContent value="recordings">
            {isLoading && recordings.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-48 rounded-xl" />
                ))}
              </div>
            ) : recordings.length === 0 ? (
              <Card className="flex flex-col items-center justify-center py-20 border-dashed">
                <Video className="h-12 w-12 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">No screen recordings found.</p>
              </Card>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {recordings.map((rec, idx) => (
                    <Card
                      key={rec.id}
                      className="overflow-hidden hover:shadow-md transition-all group border-slate-200 dark:border-slate-800 cursor-pointer"
                      onClick={() => { setLightboxItems(recordings); setLightboxIdx(idx) }}
                    >
                      {/* Thumbnail */}
                      <div className="relative aspect-[16/9] bg-slate-900">
                        {rec.thumbnail_url ? (
                          <img src={rec.thumbnail_url} alt="Recording" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Video className="h-10 w-10 text-slate-600" />
                          </div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/50 transition-colors">
                          <div className="bg-white/20 rounded-full p-3 backdrop-blur-sm border border-white/30">
                            <Play className="h-6 w-6 text-white fill-white" />
                          </div>
                        </div>
                        {rec.duration && (
                          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                            {formatDuration(rec.duration)}
                          </div>
                        )}
                      </div>

                      <div className="p-3 flex items-center justify-between">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">
                            {rec.timestamp && isValid(parseISO(rec.timestamp)) && format(parseISO(rec.timestamp), "MMM d, yyyy h:mm a")}
                          </span>
                          <span className="text-[11px] text-slate-500">{formatBytes(rec.file_size)}</span>
                        </div>
                        <a
                          href={rec.file_url}
                          download
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="ml-2 shrink-0"
                        >
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-indigo-600">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      </div>
                    </Card>
                  ))}
                </div>
                {hasMoreRec && (
                  <div className="flex justify-center pt-4">
                    <Button variant="outline" onClick={() => setRecPage(p => p + 1)} disabled={isLoading}>
                      Load More Recordings
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { format, parseISO, isValid } from "date-fns"
import { DateRange } from "react-day-picker"
import {
  Mic, Download, RefreshCw, Clock, HardDrive,
  Play, Pause, AlertCircle, Radio
} from "lucide-react"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/use-toast"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { AmbientRecording } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const PAGE_SIZE = 20

const DURATION_OPTIONS = [
  { label: "1 minute", value: 1 },
  { label: "2 minutes", value: 2 },
  { label: "5 minutes", value: 5 },
  { label: "10 minutes", value: 10 },
  { label: "15 minutes", value: 15 },
  { label: "20 minutes", value: 20 },
]

function formatBytes(bytes: number | null) {
  if (!bytes) return "Unknown"
  const k = 1024
  const sizes = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
}

function formatDuration(secs: number) {
  if (!secs) return "0s"
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

// ── Inline Audio Player ─────────────────────────────────────────
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [totalTime, setTotalTime] = useState(0)

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play()
    }
    setIsPlaying(!isPlaying)
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime)
    setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100)
  }

  const handleLoaded = () => {
    if (audioRef.current) setTotalTime(audioRef.current.duration)
  }

  const handleEnded = () => setIsPlaying(false)

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = (e.clientX - rect.left) / rect.width
    audioRef.current.currentTime = pct * audioRef.current.duration
  }

  function fmt(sec: number) {
    const m = Math.floor(sec / 60)
    const s = Math.floor(sec % 60)
    return `${m}:${s.toString().padStart(2, "0")}`
  }

  return (
    <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 w-full">
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoaded}
        onEnded={handleEnded}
      />
      <Button
        size="icon"
        variant="ghost"
        className={cn("h-8 w-8 rounded-full shrink-0", isPlaying ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600" : "text-slate-600 dark:text-slate-300")}
        onClick={togglePlay}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>

      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div
          className="relative h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full cursor-pointer overflow-hidden"
          onClick={handleSeek}
        >
          <div
            className="absolute left-0 top-0 h-full bg-indigo-500 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          <span>{fmt(currentTime)}</span>
          <span>{totalTime ? fmt(totalTime) : "--:--"}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────
export default function AmbientRecordingsPage() {
  const { toast } = useToast()
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<AmbientRecording[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()

  // Record dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedDuration, setSelectedDuration] = useState(5)

  // Command state
  const [isRecording, setIsRecording] = useState(false)
  const [recordStatus, setRecordStatus] = useState("")
  const [countdown, setCountdown] = useState(0)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchData = useCallback(async (p: number) => {
    if (!selectedDeviceId) return
    if (p === 0) setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("ambient_recordings")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .range(p * PAGE_SIZE, (p + 1) * PAGE_SIZE - 1)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", new Date(dateRange.to.getTime() + 86400000).toISOString())

    const { data: result } = await query
    const rows = (result as AmbientRecording[]) || []
    setData(prev => p === 0 ? rows : [...prev, ...rows])
    setHasMore(rows.length === PAGE_SIZE)
    if (p === 0) setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => {
    setPage(0)
    setData([])
  }, [selectedDeviceId, dateRange])

  useEffect(() => { fetchData(page) }, [fetchData, page])

  // Countdown ticker
  const startCountdown = (totalSecs: number) => {
    setCountdown(totalSecs)
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleStartRecording = async () => {
    if (!selectedDeviceId) return
    setDialogOpen(false)
    setIsRecording(true)
    setRecordStatus(`Sending command (${selectedDuration} min recording)...`)

    const supabase = createClient()

    const { data: cmd, error } = await supabase
      .from("remote_commands")
      .insert({
        device_id: selectedDeviceId,
        command_type: "record_audio",
        parameters: { duration: selectedDuration * 60 },
        status: "pending"
      } as any)
      .select()
      .single() as any

    if (error || !cmd) {
      toast({ title: "Error", description: "Failed to send recording command.", variant: "destructive" })
      setIsRecording(false)
      return
    }

    setRecordStatus(`Recording in progress...`)
    startCountdown(selectedDuration * 60)

    // Subscribe to realtime updates on this specific command
    const channel = supabase
      .channel(`rec-cmd-${cmd.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "remote_commands",
        filter: `id=eq.${cmd.id}`
      }, (payload) => {
        const updated = payload.new as any
        if (updated.status === "executed") {
          channel.unsubscribe()
          clearInterval(countdownRef.current!)
          clearTimeout(timeoutRef.current!)
          setIsRecording(false)
          setRecordStatus("")
          setCountdown(0)
          toast({ title: "🎙️ Recording Saved!", description: "Ambient recording has been uploaded. Refreshing list..." })
          setPage(0)
          fetchData(0)
        } else if (updated.status === "failed") {
          channel.unsubscribe()
          clearInterval(countdownRef.current!)
          clearTimeout(timeoutRef.current!)
          setIsRecording(false)
          setRecordStatus("")
          setCountdown(0)
          toast({ title: "Recording Failed", description: "Device reported a failure.", variant: "destructive" })
        }
      })
      .subscribe()

    // Hard timeout — selectedDuration * 60 + 60 extra seconds
    const maxWait = (selectedDuration * 60 + 60) * 1000
    timeoutRef.current = setTimeout(() => {
      channel.unsubscribe()
      clearInterval(countdownRef.current!)
      setIsRecording(false)
      setRecordStatus("")
      setCountdown(0)
      // Refresh quietly — the recording might have been saved anyway
      fetchData(0)
      toast({
        title: "Recording May Have Completed",
        description: "Command timed out. Refreshed list — check if the recording appeared.",
        variant: "destructive"
      })
    }, maxWait)
  }

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🎙️ Ambient Recordings" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Mic className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view ambient audio recordings.</p>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* Duration Picker Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5 text-rose-500" /> Start Ambient Recording
            </DialogTitle>
            <DialogDescription>
              Select how long the device microphone should record. The file will be uploaded when complete.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
            {DURATION_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSelectedDuration(opt.value)}
                className={cn(
                  "flex flex-col items-center justify-center border rounded-xl p-4 transition-all",
                  selectedDuration === opt.value
                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400/50"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                )}
              >
                <span className="text-2xl font-bold">{opt.value}</span>
                <span className="text-xs text-slate-500 mt-1">{opt.value === 1 ? "minute" : "minutes"}</span>
              </button>
            ))}
          </div>

          <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg p-3 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2 mt-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            The device microphone will record surrounding audio for the selected duration. This may affect battery life.
          </div>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={handleStartRecording}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2"
            >
              <Mic className="h-4 w-4" /> Start {selectedDuration} Min Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4 animate-in fade-in pb-20">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <PageHeader
            title="🎙️ Ambient Recordings"
            description="Audio recordings captured from the device microphone."
          />
          <div className="flex items-center gap-2 flex-wrap">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
            <Button
              onClick={() => setDialogOpen(true)}
              disabled={isRecording}
              className="bg-rose-600 hover:bg-rose-700 text-white gap-2 whitespace-nowrap"
            >
              {isRecording ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Recording...</>
              ) : (
                <><Mic className="h-4 w-4" /> Start Recording</>
              )}
            </Button>
          </div>
        </div>

        {/* Active Recording Banner */}
        {isRecording && (
          <div className="flex items-center gap-4 p-4 border border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 rounded-xl shadow-sm">
            <div className="relative shrink-0">
              <Radio className="h-7 w-7 text-rose-500" />
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-rose-500 rounded-full animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-rose-800 dark:text-rose-300 text-sm">{recordStatus}</p>
              {countdown > 0 && (
                <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                  ⏱ {formatDuration(countdown)} remaining
                </p>
              )}
            </div>
            <Badge variant="destructive" className="shrink-0 animate-pulse">LIVE</Badge>
          </div>
        )}

        {/* Loading Skeleton */}
        {isLoading && page === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && data.length === 0 && (
          <Card className="flex flex-col items-center justify-center py-20 border-dashed">
            <Mic className="h-12 w-12 text-slate-300 mb-3" />
            <p className="text-sm font-medium text-slate-500">No ambient recordings yet.</p>
            <p className="text-xs text-slate-400 mt-1">Tap "Start Recording" to remotely trigger a recording.</p>
          </Card>
        )}

        {/* Recordings List */}
        {data.length > 0 && (
          <div className="space-y-3">
            {data.map((rec) => (
              <Card key={rec.id} className="overflow-hidden border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
                <CardContent className="flex flex-col gap-4 p-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-xl bg-rose-50 dark:bg-rose-900/30 border border-rose-100 dark:border-rose-900/50 flex items-center justify-center shrink-0">
                        <Mic className="h-5 w-5 text-rose-500" />
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                          {rec.timestamp && isValid(parseISO(rec.timestamp))
                            ? format(parseISO(rec.timestamp), "EEEE, MMMM d yyyy")
                            : "Unknown date"}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {rec.timestamp && isValid(parseISO(rec.timestamp))
                              ? format(parseISO(rec.timestamp), "h:mm:ss a")
                              : "?"}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {formatDuration(rec.duration)}
                          </span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <HardDrive className="h-3 w-3" /> {formatBytes(rec.file_size)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <a
                      href={rec.recording_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0"
                    >
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>

                  {/* Audio Player */}
                  <AudioPlayer src={rec.recording_url} />
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
                  Load More
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}

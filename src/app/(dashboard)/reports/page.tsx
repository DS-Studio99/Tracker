"use client"

import { useState, useEffect, useMemo } from "react"
import { format, parseISO, subDays, startOfMonth, subMonths, endOfMonth, endOfDay, isBefore, isValid, formatDistanceToNow } from "date-fns"
import {
  FileText, Download, FileSpreadsheet, File, BarChart2,
  List, CalendarRange, Clock, Settings, Trash2, CheckCircle2,
  AlertCircle, ChevronRight, Loader2, ArrowRight, Smartphone
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { useToast } from "@/components/ui/use-toast"
import { useDeviceStore } from "@/lib/stores/device-store"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import type { DateRange } from "react-day-picker"

import { generateReport, ReportType, ReportFormat } from "@/lib/utils/report-generator"

// ── Types ──────────────────────────────────────────────────────
const REPORT_TYPES = [
  { id: "full", label: "Full Report", desc: "Complete device activity including all data", icon: BarChart2 },
  { id: "sms", label: "SMS Report", desc: "Only SMS/MMS text messages", icon: FileText },
  { id: "calls", label: "Call Report", desc: "Call logs history", icon: FileText },
  { id: "locations", label: "Location Report", desc: "GPS location coordinate history", icon: FileText },
  { id: "social", label: "Social Media Report", desc: "Messages from all platforms", icon: FileText },
  { id: "browser", label: "Internet Report", desc: "Browser history and URLs", icon: FileText },
  { id: "keylogger", label: "Keylogger Report", desc: "All system typed text", icon: FileText },
  { id: "installed_apps", label: "App Report", desc: "Installed apps inventory", icon: FileText },
  { id: "alerts", label: "Alerts Report", desc: "Security events and warnings", icon: FileText },
  { id: "custom", label: "Custom Report", desc: "Select specific modules to include", icon: Settings },
]

const CUSTOM_MODULES = [
  { id: "sms_messages", label: "SMS Messages" },
  { id: "call_logs", label: "Call Logs" },
  { id: "locations", label: "Locations" },
  { id: "social_messages", label: "Social Media" },
  { id: "browser_history", label: "Browser History" },
  { id: "keylog_entries", label: "Keylogger" },
  { id: "installed_apps", label: "Installed Apps" },
  { id: "alerts", label: "Security Alerts" },
]

const FORMATS = [
  { id: "pdf", label: "PDF Format", desc: "Formatted document with tables (Best for reading)", icon: File },
  { id: "excel", label: "Excel Spreadsheet", desc: "XLSX file with multiple sheets (Best for analysis)", icon: FileSpreadsheet },
  { id: "csv", label: "CSV File", desc: "Comma-separated raw data values", icon: List },
]

const QUICK_DATES = [
  { id: "today", label: "Today", getRange: () => ({ from: new Date(), to: new Date() }) },
  { id: "yesterday", label: "Yesterday", getRange: () => { const d = subDays(new Date(), 1); return { from: d, to: d } } },
  { id: "7days", label: "Last 7 Days", getRange: () => ({ from: subDays(new Date(), 7), to: new Date() }) },
  { id: "30days", label: "Last 30 Days", getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { id: "thisMonth", label: "This Month", getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { id: "lastMonth", label: "Last Month", getRange: () => { const d = subMonths(new Date(), 1); return { from: startOfMonth(d), to: endOfMonth(d) } } },
]

interface SavedReport {
  id: string
  deviceId: string
  deviceName: string
  type: string
  format: string
  dateStr: string
  filename: string
  sizeMb: number
  generatedAt: string
}

// ── Main Page ──────────────────────────────────────────────────
export default function ReportsPage() {
  const { toast } = useToast()
  const { selectedDeviceId, devices } = useDeviceStore()
  const activeDevice = useMemo(() => devices.find(d => d.id === selectedDeviceId), [devices, selectedDeviceId])

  const [step, setStep] = useState(1)

  // Form State
  const [type, setType] = useState<ReportType>("full")
  const [customTypes, setCustomTypes] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [formatType, setFormatType] = useState<ReportFormat>("pdf")

  // Generate State
  const [isGenerating, setIsGenerating] = useState(false)
  const [progressMsg, setProgressMsg] = useState("Initializing...")
  const [progressPct, setProgressPct] = useState(0)

  // Download State
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const [downloadName, setDownloadName] = useState("")

  // History State
  const [history, setHistory] = useState<SavedReport[]>([])

  // ── Handlers ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem("tracker_reports_history")
      if (stored) setHistory(JSON.parse(stored))
    } catch {}
  }, [])

  const saveHistory = (report: SavedReport) => {
    const updated = [report, ...history].slice(0, 50)
    setHistory(updated)
    localStorage.setItem("tracker_reports_history", JSON.stringify(updated))
  }

  const deleteHistory = (id: string) => {
    const updated = history.filter(h => h.id !== id)
    setHistory(updated)
    localStorage.setItem("tracker_reports_history", JSON.stringify(updated))
  }

  const handleGenerate = async () => {
    if (!selectedDeviceId || !activeDevice) return
    if (!dateRange?.from || !dateRange?.to) {
      toast({ title: "Incomplete", description: "Please select a date range first.", variant: "destructive" })
      return
    }

    setIsGenerating(true)
    setProgressMsg("Starting generator engine...")
    setProgressPct(5)
    setDownloadUrl(null)

    try {
      const res = await generateReport({
        device_id: selectedDeviceId,
        device_name: activeDevice.device_name || "Device",
        type,
        customTypes,
        format: formatType,
        dateRange: { from: dateRange.from, to: endOfDay(dateRange.to) },
        onProgress: (msg, pct) => {
          setProgressMsg(msg)
          setProgressPct(pct)
        }
      })

      setDownloadUrl(res.url)
      setDownloadName(res.filename)
      setStep(5) // Success step

      // Automatically trigger download
      const a = document.createElement("a")
      a.href = res.url
      a.download = res.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)

      const dateStr = `${format(dateRange.from, "MMM d")} - ${format(dateRange.to, "MMM d, yyyy")}`

      saveHistory({
        id: String(Date.now()),
        deviceId: selectedDeviceId,
        deviceName: activeDevice.device_name || "Device",
        type: type.toUpperCase(),
        format: formatType.toUpperCase(),
        dateStr,
        filename: res.filename,
        sizeMb: parseFloat((res.size / 1024 / 1024).toFixed(2)),
        generatedAt: new Date().toISOString()
      })

      toast({ title: "Report Generated", description: "Your report has been created successfully." })

    } catch (err: any) {
      toast({ title: "Generation Error", description: err.message, variant: "destructive" })
      setStep(4) // Reset back to generate screen
    } finally {
      setIsGenerating(false)
      setProgressPct(0)
    }
  }

  const resetWizard = () => {
    setStep(1)
    setDownloadUrl(null)
  }

  // ── UI Helpers ─────────────────────────────────────────────────
  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📄 Report Generator" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <FileText className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device from the sidebar to generate its data reports.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-20 animate-in fade-in">
      <PageHeader 
        title="📄 Reports & Exports" 
        description="Generate comprehensive downloadable PDF and Spreadsheet reports for this device."
      />

      {/* ── MAIN WIZARD ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Wizard Progress Sidebar */}
        <Card className="col-span-1 border-slate-200 dark:border-slate-800 shadow-sm h-fit sticky top-6">
          <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800">
            <CardTitle className="text-sm">Report Wizard</CardTitle>
          </CardHeader>
          <div className="p-2 space-y-1">
            {[
              { num: 1, label: "Select Report Type" },
              { num: 2, label: "Timeframe" },
              { num: 3, label: "Export Format" },
              { num: 4, label: "Generate & Download" },
            ].map(s => (
              <div key={s.num} onClick={() => { if (!isGenerating && step !== 5) setStep(Math.min(step, s.num)) }}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg transition-colors cursor-default",
                  step === s.num ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 font-semibold" : 
                  step > s.num ? "text-slate-500 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900" : "text-slate-400 opacity-60"
                )}
              >
                <div className={cn(
                  "h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                  step >= s.num ? "bg-indigo-600 text-white" : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                )}>
                  {step > s.num ? <CheckCircle2 className="h-4 w-4" /> : s.num}
                </div>
                <span className="text-sm">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Wizard Content */}
        <div className="col-span-1 lg:col-span-2">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm min-h-[400px] flex flex-col">
            
            {/* ── STEP 1: Type ── */}
            {step === 1 && (
              <div className="p-6 flex-1 animate-in slide-in-from-right-4">
                <h3 className="text-lg font-bold mb-4">Step 1: Choose Data to Include</h3>
                <RadioGroup value={type} onValueChange={(v: any) => setType(v)} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {REPORT_TYPES.map(opt => {
                    const Icon = opt.icon
                    const isSel = type === opt.id
                    return (
                      <Label key={opt.id} htmlFor={`rt-${opt.id}`} className={cn(
                        "flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all bg-white dark:bg-slate-950",
                        isSel ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10 shadow-sm ring-1 ring-indigo-600" : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                      )}>
                        <RadioGroupItem value={opt.id} id={`rt-${opt.id}`} className="mt-1" />
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className={cn("font-bold text-sm", isSel ? "text-indigo-900 dark:text-indigo-100" : "text-slate-800 dark:text-slate-200")}>
                            {opt.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 leading-tight">
                            {opt.desc}
                          </span>
                        </div>
                      </Label>
                    )
                  })}
                </RadioGroup>

                {type === "custom" && (
                  <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border">
                    <h4 className="text-sm font-semibold mb-3">Select Modules to Include:</h4>
                    <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                      {CUSTOM_MODULES.map(md => (
                        <div key={md.id} className="flex items-center space-x-2">
                          <Checkbox 
                            id={`mod-${md.id}`} 
                            checked={customTypes.includes(md.id)}
                            onCheckedChange={c => {
                              if (c) setCustomTypes(p => [...p, md.id])
                              else setCustomTypes(p => p.filter(x => x !== md.id))
                            }}
                          />
                          <Label htmlFor={`mod-${md.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">{md.label}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 2: Timeframe ── */}
            {step === 2 && (
              <div className="p-6 flex-1 animate-in slide-in-from-right-4">
                <h3 className="text-lg font-bold mb-4">Step 2: Select Timeframe</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
                  {QUICK_DATES.map(qd => (
                    <Button 
                      key={qd.id} 
                      variant="outline" 
                      onClick={() => setDateRange(qd.getRange())}
                      className="justify-start bg-white dark:bg-slate-950 font-semibold"
                    >
                      {qd.label}
                    </Button>
                  ))}
                </div>
                
                <Label className="text-sm font-semibold mb-2 block">Or select exact date range:</Label>
                <div className="max-w-xs border rounded-md bg-white dark:bg-slate-950 p-2 shadow-sm inline-block">
                   <DateRangeFilter date={dateRange} setDate={setDateRange} />
                </div>
                
                {dateRange?.from && dateRange?.to && (
                  <div className="mt-6 p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
                     <CalendarRange className="h-5 w-5" />
                     <div className="text-sm">
                       <strong>Selected Range:</strong><br/>
                       {format(dateRange.from, "PPP")} to {format(dateRange.to, "PPP")}
                     </div>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 3: Format ── */}
            {step === 3 && (
              <div className="p-6 flex-1 animate-in slide-in-from-right-4">
                <h3 className="text-lg font-bold mb-4">Step 3: Export Format</h3>
                <RadioGroup value={formatType} onValueChange={(v: any) => setFormatType(v)} className="space-y-4">
                  {FORMATS.map(opt => {
                    const Icon = opt.icon
                    const isSel = formatType === opt.id
                    return (
                      <Label key={opt.id} htmlFor={`fmt-${opt.id}`} className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all bg-white dark:bg-slate-950",
                        isSel ? "border-indigo-600 bg-indigo-50/30 dark:bg-indigo-900/10 shadow-sm ring-1 ring-indigo-600" : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                      )}>
                        <RadioGroupItem value={opt.id} id={`fmt-${opt.id}`} className="mt-1 shrink-0" />
                        <Icon className={cn("h-6 w-6 shrink-0", isSel ? "text-indigo-600" : "text-slate-400")} />
                        <div className="flex flex-col gap-1 min-w-0">
                          <span className={cn("font-bold text-sm", isSel ? "text-indigo-900 dark:text-indigo-100" : "text-slate-800 dark:text-slate-200")}>
                            {opt.label}
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {opt.desc}
                          </span>
                        </div>
                      </Label>
                    )
                  })}
                </RadioGroup>
              </div>
            )}

            {/* ── STEP 4: Generate ── */}
            {step === 4 && (
              <div className="p-6 flex-1 animate-in slide-in-from-right-4 flex flex-col items-center justify-center min-h-[300px] text-center">
                
                {!isGenerating ? (
                  <div className="max-w-md w-full space-y-6">
                    <div className="p-5 bg-slate-50 dark:bg-slate-900/50 border rounded-xl space-y-3 text-left">
                      <h4 className="font-bold text-slate-800 dark:text-slate-200 border-b pb-2">Ready to Generate</h4>
                      <div className="grid grid-cols-[100px_1fr] text-sm gap-2">
                         <span className="text-slate-500 font-medium">Device:</span> <span className="font-semibold">{activeDevice?.device_name}</span>
                         <span className="text-slate-500 font-medium">Report:</span> <span className="font-semibold capitalize">{type === 'custom' ? `${customTypes.length} Custom Modules` : type}</span>
                         <span className="text-slate-500 font-medium">Format:</span> <span className="font-semibold uppercase text-indigo-600 dark:text-indigo-400">{formatType}</span>
                         <span className="text-slate-500 font-medium">Range:</span> <span className="font-semibold">{dateRange?.from ? format(dateRange.from, "MMM d, yyyy") : "?"} - {dateRange?.to ? format(dateRange.to, "MMM d, yyyy") : "?"}</span>
                      </div>
                    </div>
                    
                    <Button size="lg" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white gap-2 font-bold h-12" onClick={handleGenerate}>
                      <FileText className="h-5 w-5" /> Execute & Build Report
                    </Button>
                  </div>
                ) : (
                  <div className="w-full max-w-sm flex flex-col items-center gap-6">
                     <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
                     <div className="w-full space-y-2">
                       <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{progressMsg}</span>
                       <div className="h-3 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border">
                         <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full" style={{ width: `${progressPct}%` }} />
                       </div>
                       <span className="text-xs text-slate-400 font-mono">{progressPct}%</span>
                     </div>
                     <p className="text-xs text-slate-400 max-w-[250px]">Please do not close this page. Extracting and compiling data may take a minute...</p>
                  </div>
                )}
              </div>
            )}

            {/* ── STEP 5: Success ── */}
            {step === 5 && (
              <div className="p-6 flex-1 animate-in zoom-in-95 flex flex-col items-center justify-center min-h-[300px] text-center gap-4">
                 <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 rounded-full flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-8 w-8" />
                 </div>
                 <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Report Generated!</h3>
                 <p className="text-slate-500 text-sm max-w-[300px]">Your report has been generated successfully. The download should start automatically.</p>
                 
                 <div className="flex items-center gap-3 mt-4">
                   {downloadUrl && (
                     <a href={downloadUrl} download={downloadName}>
                       <Button className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                         <Download className="h-4 w-4" /> Download Again
                       </Button>
                     </a>
                   )}
                   <Button variant="outline" onClick={resetWizard}>Create Another</Button>
                 </div>
              </div>
            )}

            {/* Wizard Navigation Footer */}
            {step < 4 && (
              <CardFooter className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20 flex justify-between">
                <Button variant="ghost" disabled={step === 1} onClick={() => setStep(s => s - 1)}>Back</Button>
                <Button onClick={() => setStep(s => s + 1)} className="gap-2" disabled={
                  (step === 1 && type === "custom" && customTypes.length === 0) ||
                  (step === 2 && (!dateRange?.from || !dateRange?.to))
                }>
                  Next Step <ArrowRight className="h-4 w-4" />
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>

      {/* ── SAVED REPORTS COMPONENT ── */}
      {history.length > 0 && (
         <Card className="border shadow-sm mt-8">
           <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
             <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-indigo-500" /> Report History</CardTitle>
             <CardDescription>Recently generated reports. Files are cached locally in your browser session.</CardDescription>
           </CardHeader>
           <CardContent className="p-0">
             <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {history.map(item => (
                  <div key={item.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                     
                     <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          "h-10 w-10 shrink-0 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm",
                          item.format === "PDF" ? "bg-rose-500" : item.format === "EXCEL" ? "bg-emerald-600" : "bg-blue-500"
                        )}>
                           {item.format}
                        </div>
                        <div className="flex flex-col min-w-0">
                           <span className="font-semibold text-sm text-slate-800 dark:text-slate-200 truncate">{item.filename}</span>
                           <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-1">
                             <span className="flex items-center gap-1"><Smartphone className="h-3 w-3" /> {item.deviceName}</span>
                             <span>•</span>
                             <span>{item.type}</span>
                             <span>•</span>
                             <span>{item.dateStr}</span>
                             <span>•</span>
                             <span className="font-mono">{item.sizeMb} MB</span>
                           </div>
                        </div>
                     </div>

                     <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
                        <span className="text-[10px] text-slate-400 mr-2 hidden md:inline-block">Generated: {formatDistanceToNow(parseISO(item.generatedAt))} ago</span>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-rose-600 mx-1" onClick={() => deleteHistory(item.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                     </div>
                  </div>
                ))}
             </div>
           </CardContent>
         </Card>
      )}

    </div>
  )
}


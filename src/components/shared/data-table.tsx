"use client"

import * as React from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { Search, ChevronLeft, ChevronRight } from "lucide-react"

export interface ColumnDef<T = any> {
  key: string
  header: string
  render?: (row: T, index?: number) => React.ReactNode
  sortable?: boolean
  width?: string
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading: boolean
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  emptyState?: React.ReactNode // Support custom empty state
  totalCount?: number
  page?: number
  pageSize?: number
  onPageChange?: (page: number) => void
  onRowClick?: (row: T) => void
  searchable?: boolean
  searchPlaceholder?: string
  searchQuery?: string
  onSearchChange?: (query: string) => void
  onSearch?: (query: string) => void
  headerActions?: React.ReactNode
  selectable?: boolean
  selectedRows?: string[]
  onSelectionChange?: (ids: string[]) => void
}

export function DataTable<T extends { id: string | number }>({
  columns,
  data,
  isLoading,
  emptyMessage = "No results found.",
  emptyIcon,
  emptyState,
  totalCount = 0,
  page = 0,
  pageSize = 10,
  onPageChange,
  onRowClick,
  searchable = true,
  searchPlaceholder = "Search...",
  searchQuery,
  onSearchChange,
  onSearch,
  headerActions,
  selectable = false,
  selectedRows = [],
  onSelectionChange,
}: DataTableProps<T>) {
  const [internalSearchTerm, setInternalSearchTerm] = React.useState("")

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setInternalSearchTerm(val)
    if (onSearchChange) onSearchChange(val)
    if (onSearch) onSearch(val)
  }

  // Use either external search query or internal state
  const currentSearchTerm = searchQuery !== undefined ? searchQuery : internalSearchTerm

  const toggleAll = () => {
    if (!onSelectionChange) return
    if (selectedRows.length === data.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(data.map(d => String(d.id)))
    }
  }

  const toggleRow = (id: string) => {
    if (!onSelectionChange) return
    const newSelected = selectedRows.includes(id)
      ? selectedRows.filter(rId => rId !== id)
      : [...selectedRows, id]
    onSelectionChange(newSelected)
  }

  return (
    <div className="space-y-4">
      {/* Table Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {searchable && (
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
            <Input
              placeholder={searchPlaceholder}
              value={currentSearchTerm}
              onChange={handleSearch}
              className="pl-9"
            />
          </div>
        )}
        <div className="flex items-center gap-2 w-full sm:w-auto ml-auto">
          {headerActions}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-md border bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900 border-b">
              <TableRow>
                {selectable && (
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={data.length > 0 && selectedRows.length === data.length}
                      onCheckedChange={toggleAll}
                      aria-label="Select all"
                    />
                  </TableHead>
                )}
                {columns.map((col) => (
                  <TableHead key={col.key} style={{ width: col.width }} className="font-semibold text-slate-700 dark:text-slate-300">
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: Math.min(pageSize, 5) }).map((_, idx) => (
                  <TableRow key={idx}>
                    {selectable && (
                      <TableCell><Skeleton className="h-4 w-4 rounded" /></TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        <Skeleton className="h-4 w-full max-w-[200px]" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="h-32 text-center"
                  >
                    {emptyState ? emptyState : (
                      <div className="flex flex-col items-center justify-center text-slate-500 space-y-3">
                        {emptyIcon}
                        <span className="text-sm font-medium">{emptyMessage}</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((row, rowIndex) => (
                  <TableRow
                    key={row.id}
                    onClick={() => onRowClick && onRowClick(row)}
                    className={`
                      hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors 
                      ${onRowClick ? 'cursor-pointer' : ''}
                      ${selectedRows.includes(String(row.id)) ? 'bg-slate-50 dark:bg-slate-900' : ''}
                    `}
                  >
                    {selectable && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedRows.includes(String(row.id))}
                          onCheckedChange={() => toggleRow(String(row.id))}
                          aria-label={`Select row ${row.id}`}
                        />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key}>
                        {col.render ? col.render(row, rowIndex) : (row as any)[col.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Pagination Footer */}
      {!isLoading && data.length > 0 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-sm text-slate-500">
            Showing {Math.min(page * pageSize + 1, totalCount)} to {Math.min((page + 1) * pageSize, totalCount)} of {totalCount} entries
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={page === 0 || !onPageChange}
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Previous</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={(page + 1) * pageSize >= totalCount || !onPageChange}
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

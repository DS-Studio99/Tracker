"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns"
import { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button, buttonVariants } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateRangeFilterProps {
  date?: DateRange
  setDate: (date: DateRange | undefined) => void
  className?: string
}

export function DateRangeFilter({ date, setDate, className }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  const quickPresets = [
    {
      label: "Today",
      range: { from: new Date(), to: new Date() },
    },
    {
      label: "Yesterday",
      range: { from: subDays(new Date(), 1), to: subDays(new Date(), 1) },
    },
    {
      label: "Last 7 Days",
      range: { from: subDays(new Date(), 7), to: new Date() },
    },
    {
      label: "Last 30 Days",
      range: { from: subDays(new Date(), 30), to: new Date() },
    },
    {
      label: "This Month",
      range: { from: startOfMonth(new Date()), to: endOfMonth(new Date()) },
    },
  ]

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger
          id="date"
          className={cn(
            buttonVariants({ variant: "outline" }),
            "w-[300px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date?.from ? (
            date.to ? (
              <>
                {format(date.from, "LLL dd, y")} -{" "}
                {format(date.to, "LLL dd, y")}
              </>
            ) : (
              format(date.from, "LLL dd, y")
            )
          ) : (
            <span>Pick a date range</span>
          )}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 flex flex-col sm:flex-row" align="end">
          <div className="border-b sm:border-b-0 sm:border-r p-4 flex flex-col gap-2 min-w-[140px]">
            <p className="font-semibold text-sm mb-2 px-2 text-slate-500">Quick Filters</p>
            {quickPresets.map((preset) => (
              <Button
                key={preset.label}
                variant="ghost"
                className="justify-start font-normal"
                onClick={() => {
                  setDate(preset.range)
                  setIsOpen(false)
                }}
              >
                {preset.label}
              </Button>
            ))}
            <Button
              variant="default"
              className="mt-4"
              onClick={() => {
                setDate(undefined)
                setIsOpen(false)
              }}
            >
              Clear Filter
            </Button>
          </div>
          <div className="p-2">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={setDate}
              numberOfMonths={2}
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

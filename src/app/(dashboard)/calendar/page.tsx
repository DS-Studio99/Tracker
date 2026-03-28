"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  format, parseISO, isValid, startOfMonth, endOfMonth,
  startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth,
  isSameDay, addMonths, subMonths, isToday
} from "date-fns"
import {
  CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, AlignLeft,
  Users, List as ListIcon, Search, Calendar as CalendarIcon
} from "lucide-react"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ScrollArea } from "@/components/ui/scroll-area"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { CalendarEvent } from "@/lib/types/database"
import { cn } from "@/lib/utils"

// Calendars color mapping generator based on name
const CALENDAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-rose-500", "bg-amber-500",
  "bg-purple-500", "bg-cyan-500", "bg-indigo-500", "bg-pink-500"
]
function getCalendarColor(name: string | null): string {
  if (!name) return "bg-slate-500"
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return CALENDAR_COLORS[Math.abs(hash) % CALENDAR_COLORS.length]
}

export default function CalendarPage() {
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<CalendarEvent[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar")
  const [searchQuery, setSearchQuery] = useState("")
  
  // Calendar View State
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState<Date>(new Date())

  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    // Since events repeat and users scroll, we fetch all events for the device
    // In a real app with 10k+ events, we'd filter by month range
    const { data: result } = await supabase
      .from("calendar_events")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("start_time", { ascending: false })
      .limit(1000)

    setData((result as CalendarEvent[]) || [])
    setIsLoading(false)
  }, [selectedDeviceId])

  useEffect(() => {
    setData([])
    fetchData()
  }, [fetchData])

  const filteredData = useMemo(() => {
    if (!searchQuery.trim()) return data
    const q = searchQuery.toLowerCase()
    return data.filter(e => 
      e.title?.toLowerCase().includes(q) || 
      e.description?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q)
    )
  }, [data, searchQuery])

  // Calendar Grid Generation
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate)
    const monthEnd = endOfMonth(monthStart)
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 })
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 })
    return eachDayOfInterval({ start: startDate, end: endDate })
  }, [currentDate])

  const eventsMapByDate = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {}
    filteredData.forEach(event => {
      if (!event.start_time) return
      const ts = parseISO(event.start_time)
      if (!isValid(ts)) return
      const dateKey = format(ts, "yyyy-MM-dd")
      if (!map[dateKey]) map[dateKey] = []
      map[dateKey].push(event)
    })
    return map
  }, [filteredData])

  const selectedDayEvents = useMemo(() => {
    const dateKey = format(selectedDay, "yyyy-MM-dd")
    return eventsMapByDate[dateKey] || []
  }, [selectedDay, eventsMapByDate])
  
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1))
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1))
  const handleToday = () => {
    const now = new Date()
    setCurrentDate(now)
    setSelectedDay(now)
  }

  const exportColumns = [
    { key: "title", header: "Title" },
    { key: "start_time", header: "Start Time" },
    { key: "end_time", header: "End Time" },
    { key: "location", header: "Location" },
    { key: "calendar_name", header: "Calendar" },
  ]

  const listColumns: ColumnDef<CalendarEvent>[] = [
    {
      key: "title",
      header: "Event",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-sm">{row.title || "Untitled Event"}</span>
          <div className="flex items-center gap-2 mt-1">
             <div className={cn("w-2 h-2 rounded-full", getCalendarColor(row.calendar_name))} />
             <span className="text-[10px] text-slate-500 truncate max-w-[150px]">{row.calendar_name || "Default Calendar"}</span>
          </div>
        </div>
      )
    },
    {
      key: "start_time",
      header: "Start",
      render: (row) => (
        <span className="text-sm whitespace-nowrap">
           {row.start_time && isValid(parseISO(row.start_time)) 
             ? format(parseISO(row.start_time), row.all_day ? "MMM d, yyyy" : "MMM d, yyyy h:mm a") 
             : "Unknown"}
        </span>
      )
    },
    {
      key: "end_time",
      header: "End",
      render: (row) => (
        <span className="text-sm whitespace-nowrap">
           {row.end_time && isValid(parseISO(row.end_time)) 
             ? format(parseISO(row.end_time), row.all_day ? "MMM d, yyyy" : "MMM d, yyyy h:mm a") 
             : "Unknown"}
        </span>
      )
    },
    {
      key: "location",
      header: "Location",
      render: (row) => <span className="text-sm truncate max-w-[150px]">{row.location || "—"}</span>
    }
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📅 Calendar Events" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <CalendarIcon className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view calendar appointments.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20 flex flex-col h-full lg:h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 shrink-0">
        <PageHeader
          title="📅 Calendar Events"
          description="View all device appointments and schedules."
        />
        <div className="flex items-center gap-2">
          <ExportButton data={filteredData} columns={exportColumns} filename="calendar_events" />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-950 p-3 rounded-lg border shadow-sm shrink-0">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search events by title, location..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1 ml-auto">
          <Button
            size="sm"
            variant={viewMode === "calendar" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs px-2"
            onClick={() => setViewMode("calendar")}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Calendar
          </Button>
          <Button
            size="sm"
            variant={viewMode === "list" ? "default" : "ghost"}
            className="h-7 gap-1.5 text-xs px-2"
            onClick={() => setViewMode("list")}
          >
            <ListIcon className="h-3.5 w-3.5" /> List
          </Button>
        </div>
      </div>

      {/* ── CALENDAR VIEW ── */}
      {viewMode === "calendar" && (
        <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-[500px]">
          {/* Main Calendar Area */}
          <Card className="flex-1 flex flex-col overflow-hidden border shadow-sm h-full">
             <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
                <div className="flex grid-cols-3 items-center gap-2">
                   <Button variant="outline" size="icon" className="h-8 w-8" onClick={handlePrevMonth}>
                     <ChevronLeft className="h-4 w-4" />
                   </Button>
                   <Button variant="outline" size="icon" className="h-8 w-8" onClick={handleNextMonth}>
                     <ChevronRight className="h-4 w-4" />
                   </Button>
                   <Button variant="outline" size="sm" className="h-8 text-xs font-semibold px-3" onClick={handleToday}>
                     Today
                   </Button>
                </div>
                <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                  {format(currentDate, "MMMM yyyy")}
                </h3>
                <div className="w-24"></div> {/* Balance spacer */}
             </div>

             <div className="flex-1 p-4 bg-slate-50/50 dark:bg-slate-900/10">
                {isLoading ? (
                  <Skeleton className="w-full h-full rounded-xl" />
                ) : (
                  <div className="grid grid-cols-7 gap-px lg:gap-1.5 h-full">
                    {/* Weekday Headers */}
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(day => (
                      <div key={day} className="text-center text-[10px] lg:text-xs font-bold text-slate-500 uppercase tracking-wider py-1 lg:py-2">
                        {day}
                      </div>
                    ))}
                    
                    {/* Calendar cells */}
                    {calendarDays.map((date, i) => {
                      const dateKey = format(date, "yyyy-MM-dd")
                      const events = eventsMapByDate[dateKey] || []
                      const isSelected = isSameDay(date, selectedDay)
                      const isCurrentM = isSameMonth(date, currentDate)
                      const isTod = isToday(date)

                      return (
                        <div
                          key={i}
                          onClick={() => setSelectedDay(date)}
                          className={cn(
                            "relative flex flex-col border border-slate-200 dark:border-slate-800 rounded-md p-1 lg:p-2 cursor-pointer transition-all min-h-[50px] lg:min-h-[80px]",
                            isTod ? "bg-indigo-50/60 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800" : (isCurrentM ? "bg-white dark:bg-slate-950" : "bg-slate-100 dark:bg-slate-900/50 opacity-50"),
                            isSelected && "ring-2 ring-indigo-500 dark:ring-indigo-400 z-10"
                          )}
                        >
                          <span className={cn(
                            "text-xs lg:text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full self-start",
                            isTod ? "bg-indigo-600 text-white" : "text-slate-700 dark:text-slate-300",
                            isSelected && !isTod && "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"
                          )}>
                            {format(date, "d")}
                          </span>

                          <div className="mt-1 lg:mt-2 space-y-1 overflow-hidden pointer-events-none w-full">
                             {/* Mobile just shows dots */}
                             <div className="flex flex-wrap gap-0.5 lg:hidden justify-start mt-1 px-1">
                               {events.map((e, index) => (
                                 <div key={index} className={cn("w-2 h-2 rounded-full", getCalendarColor(e.calendar_name))} />
                               ))}
                             </div>

                             {/* Desktop shows small text bubbles */}
                             <div className="hidden lg:flex flex-col gap-1 w-full">
                               {events.slice(0, 3).map((e, index) => (
                                 <div key={index} className={cn("text-[9px] truncate px-1.5 py-0.5 rounded text-white bg-opacity-90 font-medium", getCalendarColor(e.calendar_name))}>
                                   {e.start_time && !e.all_day ? format(parseISO(e.start_time), "h:mm a") : ""} {e.title || "Untitled"}
                                 </div>
                               ))}
                               {events.length > 3 && (
                                 <div className="text-[10px] text-slate-500 font-semibold pl-1">
                                   +{events.length - 3} more
                                 </div>
                               )}
                             </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
             </div>
          </Card>

          {/* Sidebar / Detail Area for selected day */}
          <Card className="w-full lg:w-[350px] shrink-0 border shadow-sm flex flex-col h-[400px] lg:h-full">
             <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
               <h3 className="font-bold text-lg text-slate-800 dark:text-slate-100 flex items-center justify-between">
                 {format(selectedDay, "EEEE, MMMM d")}
                 {isToday(selectedDay) && <Badge className="bg-indigo-500 hover:bg-indigo-600">TODAY</Badge>}
               </h3>
               <p className="text-sm text-slate-500 mt-1">
                 {selectedDayEvents.length} {selectedDayEvents.length === 1 ? "event" : "events"} scheduled
               </p>
             </div>
             
             <ScrollArea className="flex-1 min-h-0 bg-white dark:bg-slate-950">
               {selectedDayEvents.length === 0 ? (
                 <div className="flex flex-col items-center justify-center p-8 text-center text-slate-400 h-full mt-10">
                   <CalendarDays className="h-10 w-10 mb-3 opacity-20" />
                   <p className="text-sm font-medium text-slate-500">No events</p>
                   <p className="text-xs">Nothing scheduled for this day.</p>
                 </div>
               ) : (
                 <div className="divide-y divide-slate-100 dark:divide-slate-800">
                   {selectedDayEvents.map(event => (
                     <button
                       key={event.id}
                       onClick={() => setSelectedEvent(event)}
                       className="w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-900 border-l-4 transition-colors relative focus:outline-none focus:bg-slate-100 dark:focus:bg-slate-800"
                       style={{ borderLeftColor: `var(--${getCalendarColor(event.calendar_name).replace('bg-', '')})` }} // Fallback styling below via class
                     >
                       <div className={cn("absolute left-0 top-0 bottom-0 w-1", getCalendarColor(event.calendar_name))}></div>
                       <h4 className="font-semibold text-sm text-slate-900 dark:text-slate-100">{event.title || "Untitled Event"}</h4>
                       
                       <div className="mt-2 space-y-1.5">
                         <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                           <Clock className="h-3.5 w-3.5 text-slate-400" />
                           {event.all_day ? (
                             <Badge variant="outline" className="text-[10px] h-4">ALL DAY</Badge>
                           ) : (
                             <span>
                               {event.start_time && isValid(parseISO(event.start_time)) ? format(parseISO(event.start_time), "h:mm a") : "?"}
                               {" - "}
                               {event.end_time && isValid(parseISO(event.end_time)) ? format(parseISO(event.end_time), "h:mm a") : "?"}
                             </span>
                           )}
                         </div>

                         {event.location && (
                           <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300 mt-1">
                             <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
                             <span className="truncate">{event.location}</span>
                           </div>
                         )}
                       </div>
                     </button>
                   ))}
                 </div>
               )}
             </ScrollArea>
          </Card>
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {viewMode === "list" && (
        <Card className="overflow-hidden border shadow-sm flex-1 mb-6">
          <DataTable<CalendarEvent>
            data={filteredData}
            columns={listColumns}
            isLoading={isLoading}
            onRowClick={setSelectedEvent}
            searchable={false}
          />
        </Card>
      )}

      {/* ── DETAIL SHEET ── */}
      <Sheet open={!!selectedEvent} onOpenChange={(o) => !o && setSelectedEvent(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedEvent && (
            <div className="py-2 h-full flex flex-col">
              <SheetHeader className="mb-6 relative">
                 <div className={cn("absolute -top-6 -left-6 -right-6 h-2", getCalendarColor(selectedEvent.calendar_name))}></div>
                 <SheetTitle className="text-2xl font-bold pr-6">
                   {selectedEvent.title || "Untitled Event"}
                 </SheetTitle>
                 {selectedEvent.calendar_name && (
                   <div className="flex items-center gap-2 mt-2">
                     <Badge variant="secondary" className="font-normal text-xs">{selectedEvent.calendar_name}</Badge>
                   </div>
                 )}
              </SheetHeader>

              <div className="space-y-6 mt-4">
                {/* Time & Date */}
                <div className="flex items-start gap-3 p-4 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                  <div className="bg-white dark:bg-slate-950 p-2 rounded shadow-sm border mt-0.5">
                    <Clock className="h-5 w-5 text-indigo-500" />
                  </div>
                  <div className="flex flex-col">
                    {selectedEvent.all_day ? (
                      <span className="font-bold text-sm text-slate-800 dark:text-slate-200">All Day Event</span>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {selectedEvent.start_time && isValid(parseISO(selectedEvent.start_time)) ? format(parseISO(selectedEvent.start_time), "PPPP") : "Unknown Date"}
                        </span>
                        <div className="text-sm text-slate-500 flex items-center gap-2 mt-1 font-medium">
                          {selectedEvent.start_time && isValid(parseISO(selectedEvent.start_time)) ? format(parseISO(selectedEvent.start_time), "h:mm a") : "?"}
                          <span>to</span>
                          {selectedEvent.end_time && isValid(parseISO(selectedEvent.end_time)) ? format(parseISO(selectedEvent.end_time), "h:mm a") : "?"}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Location */}
                {selectedEvent.location && (
                  <div className="flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Location</span>
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{selectedEvent.location}</span>
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedEvent.description && (
                  <div className="flex items-start gap-3">
                    <AlignLeft className="h-4 w-4 text-slate-400 mt-0.5" />
                    <div className="flex flex-col w-full">
                      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</span>
                      <div className="text-sm text-slate-700 dark:text-slate-300 p-3 bg-slate-50 dark:bg-slate-900 rounded border whitespace-pre-wrap w-full leading-relaxed">
                        {selectedEvent.description}
                      </div>
                    </div>
                  </div>
                )}

                {/* Organizer & Attendees */}
                {(selectedEvent.organizer || (selectedEvent.attendees && selectedEvent.attendees.length > 0)) && (
                  <div className="border-t border-slate-200 dark:border-slate-800 pt-6 mt-6">
                    <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" /> Attendees & Details
                    </h4>
                    
                    <div className="space-y-4 text-sm">
                      {selectedEvent.organizer && (
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-500">Organizer:</span>
                          <span className="col-span-2 font-medium">{selectedEvent.organizer}</span>
                        </div>
                      )}
                      
                      {selectedEvent.attendees && Array.isArray(selectedEvent.attendees) && (
                        <div className="grid grid-cols-3 gap-2">
                          <span className="text-slate-500">Attendees:</span>
                          <div className="col-span-2 flex flex-col gap-1">
                            {selectedEvent.attendees.map((att: any, idx: number) => (
                              <span key={idx} className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded text-xs font-medium w-fit">
                                {typeof att === 'string' ? att : (att.name || att.email || 'Unknown')}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

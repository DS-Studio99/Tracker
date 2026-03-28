"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid, differenceInDays } from "date-fns"
import {
  Users, UserRound, Grid3X3, List as ListIcon, Search, Mail, Phone,
  Building2, Calendar as CalendarIcon, MessageSquare, PhoneCall,
  UserCircle2, ShieldAlert
} from "lucide-react"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DataTable, ColumnDef } from "@/components/shared/data-table"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { Contact } from "@/lib/types/database"
import { cn } from "@/lib/utils"

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
}

export default function ContactsPage() {
  const router = useRouter()
  const { selectedDeviceId } = useDeviceStore()

  const [data, setData] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")
  const [searchQuery, setSearchQuery] = useState("")
  const [showDeleted, setShowDeleted] = useState(false)
  const [recentlyAddedOnly, setRecentlyAddedOnly] = useState(false)
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 50

  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)

  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()

    let query = supabase
      .from("contacts")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("contact_name", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    const { data: result } = await query
    setData(prev => page === 0 ? (result as Contact[] || []) : [...prev, ...(result as Contact[] || [])])
    setIsLoading(false)
  }, [selectedDeviceId, page])

  useEffect(() => {
    setPage(0)
    setData([])
  }, [selectedDeviceId])

  useEffect(() => { fetchData() }, [fetchData])

  const filteredData = useMemo(() => {
    let filtered = data

    if (!showDeleted) {
      filtered = filtered.filter(c => !c.is_deleted)
    }

    if (recentlyAddedOnly) {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter(c => isValid(parseISO(c.created_at)) && parseISO(c.created_at) > weekAgo)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(c => {
         const nameMatch = c.contact_name?.toLowerCase().includes(q)
         const orgMatch = c.organization?.toLowerCase().includes(q)
         const phoneMatch = c.phone_numbers?.some((p: any) => p.number?.includes(q))
         const emailMatch = c.emails?.some((e: any) => e.email?.toLowerCase().includes(q))
         return nameMatch || orgMatch || phoneMatch || emailMatch
      })
    }

    return filtered
  }, [data, searchQuery, showDeleted, recentlyAddedOnly])

  const exportColumns = [
    { key: "contact_name", header: "Name" },
    { key: "organization", header: "Organization" },
    { key: "created_at", header: "Created At" },
  ]

  const columns: ColumnDef<Contact>[] = [
    {
      key: "contact_name",
      header: "Name",
      render: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 border">
            <AvatarImage src={row.photo_url || ""} />
            <AvatarFallback className="text-xs bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50">
              {getInitials(row.contact_name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className={cn("text-sm font-medium", row.is_deleted && "line-through text-slate-400")}>
              {row.contact_name || "Unknown"}
            </span>
            {row.is_deleted && <span className="text-[10px] text-rose-500 font-semibold">DELETED</span>}
          </div>
        </div>
      )
    },
    {
      key: "phone_numbers",
      header: "Phones",
      render: (row) => (
        <div className="flex flex-col gap-0.5 max-w-[200px]">
          {row.phone_numbers && row.phone_numbers.length > 0 ? (
            row.phone_numbers.map((p, i) => (
              <span key={i} className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {p.number} <span className="text-[10px] text-slate-400 uppercase">({p.type})</span>
              </span>
            ))
          ) : <span className="text-xs text-slate-400">—</span>}
        </div>
      )
    },
    {
      key: "emails",
      header: "Emails",
      render: (row) => (
        <div className="flex flex-col gap-0.5 max-w-[200px]">
          {row.emails && row.emails.length > 0 ? (
            row.emails.map((e, i) => (
              <span key={i} className="text-xs text-slate-600 dark:text-slate-300 truncate">
                {e.email} <span className="text-[10px] text-slate-400 uppercase">({e.type})</span>
              </span>
            ))
          ) : <span className="text-xs text-slate-400">—</span>}
        </div>
      )
    },
    {
      key: "organization",
      header: "Organization",
      render: (row) => <span className="text-sm truncate max-w-[150px]">{row.organization || "—"}</span>
    },
    {
      key: "last_modified",
      header: "Last Modified",
      render: (row) => (
        <span className="text-sm text-slate-500 whitespace-nowrap">
          {row.last_modified && isValid(parseISO(row.last_modified)) 
            ? format(parseISO(row.last_modified), "MMM d, yyyy") 
            : "—"}
        </span>
      )
    }
  ]

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📒 Contacts" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <UserCircle2 className="h-10 w-10 text-slate-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view contacts.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-in fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <PageHeader
          title="📒 Contacts"
          description="Address book and contact list from the device."
        />
        <div className="flex items-center gap-2">
          <ExportButton data={filteredData} columns={exportColumns} filename="contacts" />
        </div>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center justify-between bg-white dark:bg-slate-950 p-3 rounded-lg border shadow-sm">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, phone, email, org..."
            className="pl-9 h-9"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Switch id="show-deleted" checked={showDeleted} onCheckedChange={setShowDeleted} />
            <Label htmlFor="show-deleted" className="text-xs cursor-pointer text-slate-600 dark:text-slate-300">
              Show Deleted
            </Label>
          </div>
          
          <div className="flex items-center gap-2">
            <Switch id="recent" checked={recentlyAddedOnly} onCheckedChange={setRecentlyAddedOnly} />
            <Label htmlFor="recent" className="text-xs cursor-pointer text-slate-600 dark:text-slate-300">
              Added Last 7 Days
            </Label>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === "grid" ? "default" : "ghost"}
              className="h-7 gap-1.5 text-xs px-2"
              onClick={() => setViewMode("grid")}
            >
              <Grid3X3 className="h-3.5 w-3.5" /> Grid
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
      </div>

      {/* Loading Skeleton */}
      {isLoading && page === 0 && (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <Card key={i} className="p-4 flex gap-3 h-32">
                <Skeleton className="h-12 w-12 rounded-full shrink-0" />
                <div className="space-y-2 flex-1 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
             {Array.from({ length: 6 }).map((_, i) => (
               <Skeleton key={i} className="h-16 w-full" />
             ))}
          </div>
        )
      )}

      {/* Empty State */}
      {!isLoading && filteredData.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-20 border-dashed">
          <Users className="h-12 w-12 text-slate-300 mb-3" />
          <p className="text-sm font-medium text-slate-500">No contacts found.</p>
          <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters.</p>
        </Card>
      )}

      {/* ── GRID VIEW ── */}
      {!isLoading && filteredData.length > 0 && viewMode === "grid" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredData.map(contact => {
              const isNew = isValid(parseISO(contact.created_at)) && differenceInDays(new Date(), parseISO(contact.created_at)) <= 1
              const primaryPhone = contact.phone_numbers?.[0]
              const primaryEmail = contact.emails?.[0]
              
              return (
                <Card 
                  key={contact.id} 
                  className={cn(
                    "overflow-hidden cursor-pointer hover:shadow-md transition-all group border-slate-200 dark:border-slate-800",
                    contact.is_deleted && "opacity-60 bg-slate-50 dark:bg-slate-900",
                    isNew && "ring-1 ring-emerald-500"
                  )}
                  onClick={() => setSelectedContact(contact)}
                >
                  <div className="p-4 relative">
                    {/* Badges */}
                    <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                      {isNew && <Badge className="bg-emerald-500 text-[9px] px-1.5 h-4">NEW</Badge>}
                      {contact.is_deleted && <Badge variant="destructive" className="text-[9px] px-1.5 h-4">DELETED</Badge>}
                    </div>

                    <div className="flex items-start gap-4">
                      <Avatar className="h-12 w-12 border bg-white dark:bg-slate-950 shrink-0">
                        <AvatarImage src={contact.photo_url || ""} />
                        <AvatarFallback className="text-sm font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                          {getInitials(contact.contact_name)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="min-w-0 pr-8">
                        <h4 className={cn("text-sm font-semibold truncate", contact.is_deleted && "line-through")}>
                          {contact.contact_name || "Unknown"}
                        </h4>
                        
                        <div className="mt-2 space-y-1.5">
                          {primaryPhone ? (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{primaryPhone.number}</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Phone className="h-3 w-3 opacity-50 shrink-0" />
                              <span className="italic">No phone</span>
                            </div>
                          )}

                          {primaryEmail && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <Mail className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{primaryEmail.email}</span>
                            </div>
                          )}

                          {contact.organization && (
                            <div className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300">
                              <Building2 className="h-3 w-3 text-slate-400 shrink-0" />
                              <span className="truncate">{contact.organization}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
          
          {filteredData.length >= (page + 1) * PAGE_SIZE && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={() => setPage(p => p + 1)} disabled={isLoading}>
                {isLoading ? "Loading..." : "Load More"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── LIST VIEW ── */}
      {!isLoading && filteredData.length > 0 && viewMode === "list" && (
        <Card className="overflow-hidden border shadow-sm">
          <DataTable<Contact>
            data={filteredData}
            columns={columns}
            isLoading={isLoading}
            onRowClick={setSelectedContact}
            searchable={false}
          />
        </Card>
      )}

      {/* ── DETAIL SHEET ── */}
      <Sheet open={!!selectedContact} onOpenChange={(o) => !o && setSelectedContact(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedContact && (
            <div className="py-6 h-full flex flex-col">
              <div className="flex flex-col items-center text-center pb-6 border-b border-slate-200 dark:border-slate-800">
                <Avatar className="h-24 w-24 border-2 border-white dark:border-slate-900 shadow-md mb-4 bg-slate-50">
                  <AvatarImage src={selectedContact.photo_url || ""} />
                  <AvatarFallback className="text-2xl font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300">
                    {getInitials(selectedContact.contact_name)}
                  </AvatarFallback>
                </Avatar>
                
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-50">
                  {selectedContact.contact_name || "Unknown Contact"}
                </h2>
                
                {selectedContact.organization && (
                  <div className="flex items-center gap-1.5 text-sm text-slate-500 mt-1">
                    <Building2 className="h-3.5 w-3.5" />
                    {selectedContact.organization}
                  </div>
                )}

                {selectedContact.is_deleted && (
                  <Badge variant="destructive" className="mt-3">DELETED CONTACT</Badge>
                )}
              </div>

              <ScrollArea className="flex-1 mt-6">
                <div className="space-y-6">
                  {/* Phone Numbers */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5" /> Phone Numbers
                    </h4>
                    {selectedContact.phone_numbers && selectedContact.phone_numbers.length > 0 ? (
                      <div className="space-y-2">
                        {selectedContact.phone_numbers.map((p, i) => (
                          <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200">{p.number}</span>
                            <Badge variant="secondary" className="text-[10px] uppercase">{p.type || "Mobile"}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No phone numbers</p>
                    )}
                  </div>

                  {/* Emails */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5" /> Email Addresses
                    </h4>
                    {selectedContact.emails && selectedContact.emails.length > 0 ? (
                      <div className="space-y-2">
                        {selectedContact.emails.map((e, i) => (
                          <div key={i} className="flex justify-between items-center p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border">
                            <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{e.email}</span>
                            <Badge variant="secondary" className="text-[10px] uppercase shrink-0 ml-2">{e.type || "Home"}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 italic">No email addresses</p>
                    )}
                  </div>

                  {/* Notes */}
                  {selectedContact.notes && (
                    <div>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Notes</h4>
                      <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-100 dark:border-yellow-900/30 text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
                        {selectedContact.notes}
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-1.5 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Created:</span>
                      <span>{isValid(parseISO(selectedContact.created_at)) ? format(parseISO(selectedContact.created_at), "PPp") : "Unknown"}</span>
                    </div>
                    {selectedContact.last_modified && (
                      <div className="flex justify-between">
                        <span>Last Modified on Device:</span>
                        <span>{isValid(parseISO(selectedContact.last_modified)) ? format(parseISO(selectedContact.last_modified), "PPp") : selectedContact.last_modified}</span>
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2 mt-auto shrink-0">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/sms`)}
                >
                  <MessageSquare className="h-4 w-4" /> View SMS Activity
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => router.push(`/calls`)}
                >
                  <PhoneCall className="h-4 w-4" /> View Call Logs
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

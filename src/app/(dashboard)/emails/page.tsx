"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { format, parseISO, isValid } from "date-fns"
import { Inbox, Send, Edit, Trash2, Mail, Paperclip, AlertCircle, ChevronLeft, Search, MailOpen } from "lucide-react"
import { DateRange } from "react-day-picker"

import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { PageHeader } from "@/components/shared/page-header"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import DOMPurify from "isomorphic-dompurify"

import { useDeviceStore } from "@/lib/stores/device-store"
import { createClient } from "@/lib/supabase/client"
import { Email } from "@/lib/types/database"
import { cn } from "@/lib/utils"

const FOLDERS = [
  { id: "all", label: "All Mail", icon: Mail },
  { id: "inbox", label: "Inbox", icon: Inbox },
  { id: "sent", label: "Sent", icon: Send },
  { id: "drafts", label: "Drafts", icon: Edit },
  { id: "trash", label: "Trash", icon: Trash2 },
]

export default function EmailsPage() {
  const { selectedDeviceId } = useDeviceStore()
  
  const [data, setData] = useState<Email[]>([])
  const [isLoading, setIsLoading] = useState(false)
  
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFolder, setActiveFolder] = useState<string>("all")
  
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null)
  
  const fetchData = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)
    const supabase = createClient()
    
    let query = supabase
      .from("emails")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .order("timestamp", { ascending: false })
      .limit(200)

    if (dateRange?.from) query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to) query = query.lte("timestamp", dateRange.to.toISOString())

    const { data: result, error } = await query
    
    if (result && !error) {
       setData(result as Email[])
    } else {
       setData([])
    }
    
    setIsLoading(false)
  }, [selectedDeviceId, dateRange])

  useEffect(() => { 
    fetchData() 
  }, [fetchData])

  // Deselect email if folder changes or filters change
  useEffect(() => {
    setSelectedEmail(null)
  }, [activeFolder, searchQuery])

  // Mark selected email as read locally
  useEffect(() => {
    if (selectedEmail && !selectedEmail.is_read) {
       setData(prev => prev.map(e => e.id === selectedEmail.id ? { ...e, is_read: true } : e))
       
       // Fire-and-forget background update to DB
       const markRead = async () => {
         const supabase = createClient()
         await (supabase.from('emails') as any).update({ is_read: true }).eq('id', selectedEmail.id)
       }
       markRead()
    }
  }, [selectedEmail])

  // Derived state filtering
  const filteredEmails = useMemo(() => {
    let filtered = data

    // Folder
    if (activeFolder !== "all") {
      filtered = filtered.filter(e => {
         const type = e.email_type?.toLowerCase() || ""
         const folder = e.folder?.toLowerCase() || ""
         
         if (activeFolder === "inbox") return type === "incoming" || folder.includes("inbox")
         if (activeFolder === "sent") return type === "outgoing" || folder.includes("sent")
         if (activeFolder === "drafts") return type === "draft" || folder.includes("draft")
         if (activeFolder === "trash") return folder.includes("trash") || folder.includes("bin") || folder.includes("deleted")
         return true
      })
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(e => 
        (e.subject && e.subject.toLowerCase().includes(q)) || 
        (e.body_preview && e.body_preview.toLowerCase().includes(q)) ||
        (e.from_address && e.from_address.toLowerCase().includes(q)) ||
        (e.from_name && e.from_name.toLowerCase().includes(q))
      )
    }

    return filtered
  }, [data, activeFolder, searchQuery])

  const folderCounts = useMemo(() => {
    return {
      all: data.length,
      inbox: data.filter(e => e.email_type === "incoming" || e.folder?.toLowerCase().includes("inbox")).length,
      sent: data.filter(e => e.email_type === "outgoing" || e.folder?.toLowerCase().includes("sent")).length,
      drafts: data.filter(e => e.email_type === "draft" || e.folder?.toLowerCase().includes("draft")).length,
      trash: data.filter(e => e.folder?.toLowerCase().includes("trash") || e.folder?.toLowerCase().includes("bin")).length,
    }
  }, [data])

  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title="📧 Emails" />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">Select a device to view email communications.</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] animate-in fade-in pb-10 sm:pb-0">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <PageHeader
          title="📧 Emails"
          description="View incoming and outgoing emails."
        />
        <DateRangeFilter date={dateRange} setDate={setDateRange} />
      </div>

      <Card className="flex-1 flex overflow-hidden border shadow-sm relative">
        {/* LEFT COLUMN: Folders */}
        <div className="hidden md:flex flex-col w-[200px] border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
          <div className="p-4 font-semibold text-sm uppercase text-slate-500 tracking-wider hidden md:block">
            Mailboxes
          </div>
          <ScrollArea className="flex-1 px-3 min-h-0">
            <div className="space-y-1">
              {FOLDERS.map((folder) => {
                const Icon = folder.icon
                const isActive = activeFolder === folder.id
                return (
                  <button
                    key={folder.id}
                    onClick={() => setActiveFolder(folder.id)}
                    className={cn(
                      "flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-md transition-colors",
                      isActive 
                        ? "bg-emerald-100 text-emerald-900 border-none dark:bg-emerald-900/40 dark:text-emerald-300" 
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", isActive ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500")} />
                      {folder.label}
                    </div>
                    {folderCounts[folder.id as keyof typeof folderCounts] > 0 && (
                      <span className={cn(
                        "text-xs font-semibold px-2 py-0.5 rounded-full ml-auto",
                        isActive ? "bg-emerald-200/50 dark:bg-emerald-800" : "bg-slate-200 dark:bg-slate-800"
                      )}>
                        {folderCounts[folder.id as keyof typeof folderCounts]}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        {/* MIDDLE COLUMN: List */}
        <div className={cn(
          "flex flex-col bg-white dark:bg-slate-950 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 transition-all",
          selectedEmail ? "hidden lg:flex w-[350px] 2xl:w-[400px]" : "flex-1 lg:w-[350px] lg:flex-none 2xl:w-[400px]"
        )}>
           <div className="p-3 border-b border-slate-200 dark:border-slate-800">
             <div className="relative">
               <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-500" />
               <Input 
                 placeholder="Search emails..." 
                 className="w-full pl-9 h-9" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 id="email-search"
               />
             </div>
             
             {/* Mobile Folder Selector */}
             <div className="flex space-x-2 overflow-x-auto mt-3 pb-1 md:hidden no-scrollbar">
                {FOLDERS.map((folder) => (
                  <Button
                    key={folder.id}
                    variant={activeFolder === folder.id ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs rounded-full flex-shrink-0 px-3"
                    onClick={() => setActiveFolder(folder.id)}
                  >
                    {folder.label}
                  </Button>
                ))}
             </div>
           </div>

           <ScrollArea className="flex-1 min-h-0">
             {isLoading ? (
                <div className="p-4 space-y-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <Skeleton className="h-3 w-5/6" />
                      </div>
                    </div>
                  ))}
                </div>
             ) : filteredEmails.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-400 h-full">
                  <MailOpen className="h-10 w-10 mb-3 opacity-20" />
                  <p className="text-sm font-medium text-center">No emails found.</p>
                  <p className="text-xs text-center mt-1">Try changing filters or dates.</p>
                </div>
             ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredEmails.map((email) => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedEmail(email)}
                      className={cn(
                        "w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors flex flex-col gap-1 relative group focus:outline-none",
                        selectedEmail?.id === email.id && "bg-slate-100 dark:bg-slate-800"
                      )}
                    >
                      {!email.is_read && (
                        <span className="absolute left-1.5 top-5 h-2 w-2 rounded-full bg-blue-500"></span>
                      )}
                      
                      <div className="flex justify-between items-baseline gap-2 pl-2">
                        <span className={cn(
                          "truncate text-sm flex-1",
                          !email.is_read ? "font-bold text-slate-900 dark:text-slate-100" : "font-medium text-slate-700 dark:text-slate-300"
                        )}>
                          {email.email_type === 'outgoing' 
                             ? `To: ${email.to_addresses ? (Array.isArray(email.to_addresses) ? email.to_addresses.join(', ') : email.to_addresses) : 'Unknown'}` 
                             : (email.from_name || email.from_address?.split('@')[0] || "Unknown Sender")}
                        </span>
                        
                        <span className="text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0">
                          {isValid(parseISO(email.timestamp)) 
                            ? (new Date().toDateString() === new Date(email.timestamp).toDateString()
                                 ? format(parseISO(email.timestamp), "h:mm a")
                                 : format(parseISO(email.timestamp), "MMM d")) 
                            : ""}
                        </span>
                      </div>
                      
                      <div className="pl-2 w-full flex items-center justify-between">
                         <span className={cn(
                           "truncate text-[13px]",
                           !email.is_read ? "font-semibold text-slate-800 dark:text-slate-200" : "font-medium text-slate-600 dark:text-slate-400"
                         )}>
                           {email.subject || '(No Subject)'}
                         </span>
                         {email.has_attachments && <Paperclip className="h-3 w-3 text-slate-400 ml-2 shrink-0" />}
                      </div>
                      
                      <span className="pl-2 truncate text-xs text-slate-500 line-clamp-2 leading-snug break-words pr-2 mt-0.5 whitespace-normal">
                         {email.body_preview || '(No content preview)'}
                      </span>
                    </button>
                  ))}
                </div>
             )}
           </ScrollArea>
        </div>

        {/* RIGHT COLUMN: Detail */}
        <div className={cn(
          "flex flex-col bg-slate-50/50 dark:bg-[#0c0c0e] h-full absolute lg:relative z-10 w-full overflow-hidden transition-transform",
          selectedEmail ? "translate-x-0" : "translate-x-full lg:translate-x-0 lg:flex-1"
        )}>
          {selectedEmail ? (
            <div className="flex flex-col h-full w-full">
              {/* Detail Header (Mobile Back Button) */}
              <div className="p-3 border-b flex items-center gap-3 bg-white dark:bg-slate-950 flex-shrink-0">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSelectedEmail(null)}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <Badge variant="outline" className="capitalize text-[10px] bg-slate-50 dark:bg-slate-900">
                    {selectedEmail.folder || selectedEmail.email_type}
                  </Badge>
                </div>
              </div>

              {/* Email Content */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto w-full">
                  <h1 className="text-xl sm:text-2xl font-semibold mb-6 text-slate-900 dark:text-slate-50 leading-snug">
                    {selectedEmail.subject || '(No Subject)'}
                  </h1>

                  <div className="flex items-start justify-between border-b border-slate-200 dark:border-slate-800 pb-5 mb-5 flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg uppercase shrink-0">
                        {selectedEmail.from_name?.charAt(0) || selectedEmail.from_address?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap text-sm">
                          <span className="font-semibold text-slate-900 dark:text-slate-100">{selectedEmail.from_name || selectedEmail.from_address}</span>
                          <span className="text-slate-500 text-xs">&lt;{selectedEmail.from_address}&gt;</span>
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                           to {Array.isArray(selectedEmail.to_addresses) ? selectedEmail.to_addresses.join(', ') : selectedEmail.to_addresses || 'me'}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 whitespace-nowrap">
                       {isValid(parseISO(selectedEmail.timestamp)) ? format(parseISO(selectedEmail.timestamp), "MMM d, yyyy, h:mm a") : selectedEmail.timestamp}
                    </div>
                  </div>

                  {/* Body Rendering */}
                  <div className="prose prose-sm dark:prose-invert max-w-none text-slate-800 dark:text-slate-200"
                    dangerouslySetInnerHTML={{ 
                      __html: DOMPurify.sanitize(selectedEmail.body_html || selectedEmail.body_preview || "<i>(No body found)</i>", {
                         USE_PROFILES: { html: true }
                      }) 
                    }}
                  />
                  
                  {/* Attachments UI Mockup */}
                  {selectedEmail.has_attachments && (
                     <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800">
                       <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                         <Paperclip className="h-4 w-4 text-slate-500" />
                         Attachments
                       </h4>
                       <div className="flex flex-wrap gap-3">
                         {Array.isArray(selectedEmail.attachments) ? selectedEmail.attachments.map((att: any, idx: number) => (
                           <div key={idx} className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center gap-3 w-64 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors cursor-pointer">
                              <div className="h-10 w-10 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center shrink-0">
                                <Paperclip className="h-4 w-4 text-slate-400" />
                              </div>
                              <div className="min-w-0">
                                 <p className="text-sm font-medium truncate">{att.name || `Attachment_${idx+1}`}</p>
                                 <p className="text-xs text-slate-500">{Math.round((att.size || 0)/1024)} KB</p>
                              </div>
                           </div>
                         )) : (
                           <div className="border border-slate-200 dark:border-slate-800 rounded-lg p-3 flex items-center gap-3 w-64">
                              <p className="text-sm text-slate-500">Encrypted Attachment Data</p>
                           </div>
                         )}
                       </div>
                     </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="hidden lg:flex flex-col items-center justify-center h-full text-slate-400 flex-1">
              <Mail className="h-12 w-12 mb-4 opacity-20" />
              <p className="text-sm font-medium">Select an email to read</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

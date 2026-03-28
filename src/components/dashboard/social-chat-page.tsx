"use client"

import { useEffect, useState, useMemo, useRef, useCallback } from "react"
import { format, parseISO, isToday, isYesterday, isValid } from "date-fns"
import {
  Search,
  ChevronLeft,
  MessageSquareDashed,
  Users,
  AlertCircle,
  ArrowDown
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { useDeviceStore } from "@/lib/stores/device-store"
import { SocialMessage } from "@/lib/types/database"

import { PageHeader } from "@/components/shared/page-header"
import { ExportButton } from "@/components/shared/export-button"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { ConversationListItem } from "@/components/dashboard/conversation-list-item"
import { SocialChatBubble } from "@/components/dashboard/social-chat-bubble"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { DateRange } from "react-day-picker"

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationKey {
  /** Unique conversation identifier */
  key: string
  name: string
  isGroup: boolean
  groupId: string | null
  senderId: string | null
  receiverId: string | null
}

interface Conversation {
  key: string
  name: string
  isGroup: boolean
  groupId: string | null
  senderId: string | null
  messages: SocialMessage[]
  lastMessage: SocialMessage
}

export interface SocialChatPageProps {
  platform: string
  platformName: string
  platformIcon: string
  platformColor: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getConversationKey(msg: SocialMessage): string {
  if (msg.group_id) return `group:${msg.group_id}`
  // Normalise the pair so (A→B) and (B→A) share the same key
  const pair = [msg.sender_id || msg.sender_name || "?", msg.receiver_id || msg.receiver_name || "?"]
    .sort()
    .join("|")
  return `dm:${pair}`
}

function getConversationName(msg: SocialMessage, deviceId: string): string {
  if (msg.group_name) return msg.group_name
  if (msg.direction === "outgoing") return msg.receiver_name || msg.receiver_id || "Unknown"
  return msg.sender_name || msg.sender_id || "Unknown"
}

function formatDateSeparator(timestamp: string): string {
  try {
    const d = parseISO(timestamp)
    if (!isValid(d)) return timestamp
    if (isToday(d)) return "Today"
    if (isYesterday(d)) return "Yesterday"
    return format(d, "MMMM d, yyyy")
  } catch {
    return timestamp
  }
}

// ─── Date Separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 my-4 px-2">
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
      <span className="text-xs text-slate-400 dark:text-slate-500 font-medium shrink-0 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
        {label}
      </span>
      <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SocialChatPage({ platform, platformName, platformIcon, platformColor }: SocialChatPageProps) {
  const { selectedDeviceId } = useDeviceStore()

  const [allMessages, setAllMessages] = useState<SocialMessage[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [dateRange, setDateRange] = useState<DateRange | undefined>()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const [mobileView, setMobileView] = useState<"list" | "chat">("list")

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatScrollRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // ── Fetch all messages for this platform ─────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!selectedDeviceId) return
    setIsLoading(true)

    const supabase = createClient()
    let query = supabase
      .from("social_messages")
      .select("*")
      .eq("device_id", selectedDeviceId)
      .eq("platform", platform)
      .order("timestamp", { ascending: true })
      .limit(2000)

    if (dateRange?.from)
      query = query.gte("timestamp", dateRange.from.toISOString())
    if (dateRange?.to)
      query = query.lte("timestamp", dateRange.to.toISOString())

    const { data, error } = await query
    if (!error && data) setAllMessages(data as SocialMessage[])
    setIsLoading(false)
  }, [selectedDeviceId, platform, dateRange])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // ── Build conversations ───────────────────────────────────────────────────
  const conversations = useMemo<Conversation[]>(() => {
    const map = new Map<string, Conversation>()

    allMessages.forEach((msg) => {
      const key = getConversationKey(msg)

      if (!map.has(key)) {
        map.set(key, {
          key,
          name: getConversationName(msg, selectedDeviceId || ""),
          isGroup: !!msg.group_id,
          groupId: msg.group_id,
          senderId: msg.sender_id,
          messages: [],
          lastMessage: msg,
        })
      }

      const conv = map.get(key)!
      conv.messages.push(msg)
      // keep last message as the most recent
      if (new Date(msg.timestamp) > new Date(conv.lastMessage.timestamp)) {
        conv.lastMessage = msg
      }
    })

    // Sort conversations by latest message DESC
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.lastMessage.timestamp).getTime() - new Date(a.lastMessage.timestamp).getTime()
    )
  }, [allMessages, selectedDeviceId])

  // ── Filtered conversations (search) ──────────────────────────────────────
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations

    const q = searchQuery.toLowerCase()
    return conversations.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.messages.some((m) => m.body?.toLowerCase().includes(q))
    )
  }, [conversations, searchQuery])

  // ── Active conversation ───────────────────────────────────────────────────
  const activeConversation = useMemo(
    () => filteredConversations.find((c) => c.key === activeKey) ?? null,
    [filteredConversations, activeKey]
  )

  // ── Auto scroll chat to bottom ────────────────────────────────────────────
  useEffect(() => {
    if (activeConversation) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100)
    }
  }, [activeKey])

  // ── Scroll-to-bottom button ───────────────────────────────────────────────
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distFromBottom > 200)
  }

  // ── Export columns ────────────────────────────────────────────────────────
  const exportColumns = [
    { key: "timestamp", header: "Timestamp" },
    { key: "direction", header: "Direction" },
    { key: "sender_name", header: "Sender" },
    { key: "receiver_name", header: "Receiver" },
    { key: "group_name", header: "Group" },
    { key: "message_type", header: "Type" },
    { key: "body", header: "Message" },
  ]

  const exportData = activeConversation ? activeConversation.messages : allMessages

  // ─── No device selected ───────────────────────────────────────────────────
  if (!selectedDeviceId) {
    return (
      <div className="p-8 pb-20 animate-in fade-in">
        <PageHeader title={`${platformName} Messages`} />
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed border-2">
          <AlertCircle className="h-10 w-10 text-amber-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Device Selected</h3>
          <p className="text-slate-500 max-w-sm">
            Please select a device from the devices page to view {platformName} messages.
          </p>
        </Card>
      </div>
    )
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="w-full space-y-4 pb-20 animate-in fade-in flex flex-col h-full">
      {/* Page header */}
      <PageHeader
        title={`${platformIcon} ${platformName} Messages`}
        description={`View all ${platformName} conversations captured from the device`}
        actions={
          <div className="flex items-center gap-2">
            <DateRangeFilter date={dateRange} setDate={setDateRange} />
            <ExportButton
              data={exportData}
              columns={exportColumns}
              filename={`${platformName}_${activeConversation?.name ?? "all"}`}
            />
          </div>
        }
      />

      {/* Two-panel layout */}
      <Card className="flex overflow-hidden border shadow-sm" style={{ height: "calc(100vh - 210px)", minHeight: 520 }}>

        {/* ── LEFT PANEL (Conversation List) ─────────────────────────────── */}
        <div
          className={cn(
            "flex flex-col border-r dark:border-slate-800 shrink-0",
            "w-full md:w-[320px] lg:w-[340px]",
            // Mobile: hide when chat is open
            mobileView === "chat" ? "hidden md:flex" : "flex"
          )}
        >
          {/* Search */}
          <div className="p-3 border-b dark:border-slate-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder={`Search ${platformName} conversations…`}
                className="pl-9 h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Count */}
          <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 border-b dark:border-slate-800 flex justify-between">
            <span>{filteredConversations.length} conversation{filteredConversations.length !== 1 ? "s" : ""}</span>
            <span style={{ color: platformColor }}>{platformIcon} {platformName}</span>
          </div>

          {/* List */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-0.5">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex gap-3 p-3 items-center">
                    <Skeleton className="h-11 w-11 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : filteredConversations.length === 0 ? (
                <div className="text-center py-16 text-slate-400 dark:text-slate-600 space-y-2">
                  <MessageSquareDashed className="h-10 w-10 mx-auto opacity-40" />
                  <p className="text-sm">
                    {searchQuery ? "No conversations match your search." : `No ${platformName} messages found.`}
                  </p>
                </div>
              ) : (
                filteredConversations.map((conv) => (
                  <ConversationListItem
                    key={conv.key}
                    name={conv.name}
                    lastMessage={conv.lastMessage.body ?? (conv.lastMessage.message_type !== "text" ? `📎 ${conv.lastMessage.message_type}` : null)}
                    timestamp={conv.lastMessage.timestamp}
                    isGroup={conv.isGroup}
                    isActive={conv.key === activeKey}
                    isOutgoing={conv.lastMessage.direction === "outgoing"}
                    avatarColor={platformColor}
                    searchQuery={searchQuery}
                    onClick={() => {
                      setActiveKey(conv.key)
                      setMobileView("chat")
                    }}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ── RIGHT PANEL (Chat Thread) ───────────────────────────────────── */}
        <div
          className={cn(
            "flex-1 flex flex-col min-w-0",
            mobileView === "list" ? "hidden md:flex" : "flex"
          )}
        >
          {activeConversation ? (
            <>
              {/* Chat Header */}
              <div
                className="flex items-center gap-3 px-4 py-3 border-b dark:border-slate-800 shrink-0"
                style={{ background: `${platformColor}10` }}
              >
                {/* Mobile back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden h-8 w-8"
                  onClick={() => setMobileView("list")}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>

                {/* Avatar */}
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                  style={{ background: platformColor }}
                >
                  {activeConversation.isGroup
                    ? <Users className="h-4 w-4" />
                    : activeConversation.name.charAt(0).toUpperCase()
                  }
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900 dark:text-slate-50 truncate">
                    {activeConversation.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeConversation.messages.length} messages
                  </p>
                </div>

                <Badge
                  variant="secondary"
                  className="text-white shrink-0 text-xs"
                  style={{ background: platformColor }}
                >
                  {platformIcon} {platformName}
                </Badge>
              </div>

              {/* Messages area */}
              <div
                ref={chatScrollRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 bg-slate-50 dark:bg-slate-950"
                onScroll={handleScroll}
              >
                {(() => {
                  const msgs = activeConversation.messages
                  const elements: React.ReactNode[] = []
                  let lastDateLabel = ""

                  msgs.forEach((msg, idx) => {
                    const dateLabel = formatDateSeparator(msg.timestamp)
                    if (dateLabel !== lastDateLabel) {
                      elements.push(<DateSeparator key={`sep-${idx}`} label={dateLabel} />)
                      lastDateLabel = dateLabel
                    }

                    const isOutgoing = msg.direction === "outgoing"
                    // Show sender name only in group chats for incoming
                    const showSender = activeConversation.isGroup && !isOutgoing

                    elements.push(
                      <SocialChatBubble
                        key={msg.id}
                        message={msg}
                        isOutgoing={isOutgoing}
                        showSender={showSender}
                        platformColor={platformColor}
                        searchQuery={searchQuery}
                      />
                    )
                  })

                  return elements
                })()}

                <div ref={messagesEndRef} />
              </div>

              {/* Scroll to bottom button */}
              {showScrollBtn && (
                <Button
                  size="icon"
                  className="absolute bottom-24 right-8 h-9 w-9 rounded-full shadow-lg z-10"
                  style={{ background: platformColor }}
                  onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                >
                  <ArrowDown className="h-4 w-4 text-white" />
                </Button>
              )}
            </>
          ) : (
            /* No conversation selected placeholder */
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 space-y-4 bg-slate-50 dark:bg-slate-950">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-4xl"
                style={{ background: `${platformColor}15` }}
              >
                {platformIcon}
              </div>
              <div className="text-center space-y-1">
                <h3 className="font-semibold text-slate-600 dark:text-slate-300 text-lg">
                  Select a conversation
                </h3>
                <p className="text-sm max-w-xs">
                  Choose a conversation from the left panel to view the full chat thread.
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  )
}

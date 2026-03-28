"use client"

import { formatDistanceToNow, parseISO, isValid } from "date-fns"
import { ArrowUpRight, ArrowDownLeft, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"

interface ConversationListItemProps {
  name: string
  lastMessage: string | null
  timestamp: string
  unreadCount?: number
  isGroup?: boolean
  avatarColor?: string
  isActive?: boolean
  isOutgoing?: boolean
  onClick: () => void
  searchQuery?: string
}

function highlightText(text: string, query: string) {
  if (!query || !text) return <span>{text}</span>
  const parts = text.split(new RegExp(`(${query})`, 'gi'))
  return (
    <span>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5">{part}</mark>
          : <span key={i}>{part}</span>
      )}
    </span>
  )
}

function formatRelativeTime(timestamp: string): string {
  try {
    const d = parseISO(timestamp)
    if (!isValid(d)) return ""
    return formatDistanceToNow(d, { addSuffix: false, includeSeconds: false })
  } catch {
    return ""
  }
}

export function ConversationListItem({
  name,
  lastMessage,
  timestamp,
  unreadCount = 0,
  isGroup = false,
  avatarColor = "#6366f1",
  isActive = false,
  isOutgoing = false,
  onClick,
  searchQuery = ""
}: ConversationListItemProps) {
  const initials = name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?"

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 text-left rounded-xl transition-all",
        "hover:bg-slate-100 dark:hover:bg-slate-800/70 active:scale-[0.99]",
        isActive
          ? "bg-slate-100 dark:bg-slate-800 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
          : "bg-transparent"
      )}
    >
      {/* Avatar */}
      <div
        className="h-11 w-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-sm"
        style={{ background: avatarColor }}
      >
        {isGroup ? <Users className="h-5 w-5" /> : initials}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className={cn("font-semibold text-sm truncate", isActive ? "text-slate-900 dark:text-slate-50" : "text-slate-800 dark:text-slate-200")}>
            {highlightText(name, searchQuery)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0 whitespace-nowrap">
            {formatRelativeTime(timestamp)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Direction icon */}
          {isOutgoing
            ? <ArrowUpRight className="h-3 w-3 text-blue-400 dark:text-blue-500 shrink-0" />
            : <ArrowDownLeft className="h-3 w-3 text-slate-400 dark:text-slate-500 shrink-0" />
          }

          <p className={cn("text-xs truncate", isActive ? "text-slate-600 dark:text-slate-300" : "text-slate-500 dark:text-slate-400")}>
            {lastMessage ? highlightText(lastMessage, searchQuery) : <span className="italic">No messages yet</span>}
          </p>

          {/* Unread badge */}
          {unreadCount > 0 && (
            <Badge className="ml-auto shrink-0 h-4 min-w-4 px-1 text-[10px] rounded-full" style={{ background: avatarColor }}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Badge>
          )}
        </div>
      </div>
    </button>
  )
}

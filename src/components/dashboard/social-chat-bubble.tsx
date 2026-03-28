"use client"

import { useState } from "react"
import { format, parseISO, isValid } from "date-fns"
import {
  Image as ImageIcon,
  Film,
  Music,
  FileText,
  MapPin,
  Sticker,
  Phone,
  Trash2,
  User,
  Download,
  Play
} from "lucide-react"
import { SocialMessage } from "@/lib/types/database"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { MapWrapper } from "@/components/maps/map-wrapper"

interface SocialChatBubbleProps {
  message: SocialMessage
  isOutgoing: boolean
  showSender: boolean
  platformColor: string
  searchQuery?: string
}

function highlightText(text: string, query: string) {
  if (!query || !text) return <>{text}</>
  const parts = text.split(new RegExp(`(${query})`, 'gi'))
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded-sm px-0.5">{part}</mark>
          : part
      )}
    </>
  )
}

function formatMsgTime(timestamp: string): string {
  try {
    const d = parseISO(timestamp)
    if (!isValid(d)) return ""
    return format(d, "h:mm a")
  } catch {
    return ""
  }
}

function MediaContent({ message, isOutgoing }: { message: SocialMessage; isOutgoing: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [showMap, setShowMap] = useState(false)

  switch (message.message_type) {
    case 'image':
      return (
        <div className="mt-1">
          {message.media_url ? (
            <>
              <img
                src={message.media_thumbnail_url || message.media_url}
                alt="Shared image"
                className={cn(
                  "rounded-lg object-cover border border-black/10 cursor-zoom-in transition-all",
                  expanded ? "max-w-xs w-full" : "max-h-44 max-w-[220px]"
                )}
                onClick={() => setExpanded(!expanded)}
                loading="lazy"
              />
              {expanded && (
                <a
                  href={message.media_url}
                  download
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 text-xs flex items-center gap-1 text-blue-500 hover:underline"
                >
                  <Download className="h-3 w-3" /> Download
                </a>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <ImageIcon className="h-4 w-4" /> Photo
            </div>
          )}
        </div>
      )

    case 'video':
      return (
        <div className="mt-1">
          {message.media_url ? (
            <div className="relative rounded-lg overflow-hidden max-w-[240px] border border-black/10">
              <video
                src={message.media_url}
                controls
                preload="metadata"
                className="max-h-44 w-full object-cover rounded-lg"
              />
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <Film className="h-4 w-4" /> Video
            </div>
          )}
        </div>
      )

    case 'audio':
      return (
        <div className="mt-2 flex items-center gap-2">
          {message.media_url ? (
            <div className={cn("flex items-center gap-2 rounded-full px-3 py-1.5 text-sm", isOutgoing ? "bg-white/20" : "bg-slate-200 dark:bg-slate-700")}>
              <Music className="h-4 w-4 shrink-0" />
              <audio controls preload="metadata" className="h-8 w-36 shrink-0" style={{ minWidth: 0 }}>
                <source src={message.media_url} />
              </audio>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <Music className="h-4 w-4" /> Audio
            </div>
          )}
        </div>
      )

    case 'document':
      return (
        <div className="mt-1">
          {message.media_url ? (
            <a
              href={message.media_url}
              download
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 border text-sm hover:opacity-90 transition-opacity",
                isOutgoing ? "border-white/20 bg-white/10 text-white" : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              )}
            >
              <FileText className="h-5 w-5 shrink-0" />
              <span className="truncate max-w-[150px]">{message.body || "Document"}</span>
              <Download className="h-4 w-4 ml-auto shrink-0 opacity-70" />
            </a>
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              <FileText className="h-4 w-4" /> Document
            </div>
          )}
        </div>
      )

    case 'location':
      return (
        <div className="mt-1 space-y-1">
          <div
            className="flex items-center gap-2 text-sm cursor-pointer hover:underline"
            onClick={() => setShowMap(!showMap)}
          >
            <MapPin className="h-4 w-4 shrink-0" />
            <span>Location shared — {showMap ? "hide" : "view"} map</span>
          </div>
          {showMap && (
            <div className="h-36 w-48 rounded-lg overflow-hidden border border-black/10">
              <div className="h-full w-full flex items-center justify-center bg-slate-100 text-xs text-slate-500">
                📍 Map unavailable (no coords in message)
              </div>
            </div>
          )}
        </div>
      )

    case 'sticker':
      return (
        <div className="mt-1">
          {message.media_url ? (
            <img src={message.media_url} alt="Sticker" className="h-20 w-20 object-contain" loading="lazy" />
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              🎭 Sticker
            </div>
          )}
        </div>
      )

    case 'gif':
      return (
        <div className="mt-1">
          {message.media_url ? (
            <img src={message.media_url} alt="GIF" className="rounded-lg max-h-36 max-w-[220px] object-cover" loading="lazy" />
          ) : (
            <div className="flex items-center gap-2 text-sm opacity-70">
              🎞️ GIF
            </div>
          )}
        </div>
      )

    case 'contact':
      return (
        <div className={cn("mt-1 flex items-center gap-2 rounded-lg px-3 py-2 border text-sm", isOutgoing ? "border-white/20 bg-white/10" : "border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800")}>
          <User className="h-5 w-5 shrink-0 opacity-70" />
          <span>{message.body || "Contact card"}</span>
        </div>
      )

    case 'call_log':
      return (
        <div className="mt-1 flex items-center gap-2 text-sm opacity-80">
          <Phone className="h-4 w-4" /> {message.body || "Call"}
        </div>
      )

    default:
      return null
  }
}

export function SocialChatBubble({
  message,
  isOutgoing,
  showSender,
  platformColor,
  searchQuery = ""
}: SocialChatBubbleProps) {
  return (
    <div className={cn("flex", isOutgoing ? "justify-end" : "justify-start")}>
      <div className={cn("max-w-[75%] flex flex-col", isOutgoing ? "items-end" : "items-start")}>
        {/* Sender name (for group chats) */}
        {showSender && !isOutgoing && message.sender_name && (
          <span
            className="text-xs font-semibold mb-1 ml-1"
            style={{ color: platformColor }}
          >
            {message.sender_name}
          </span>
        )}

        {/* Bubble */}
        <div
          className={cn(
            "px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
            isOutgoing
              ? "text-white rounded-br-sm"
              : "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-sm shadow-sm",
            message.is_deleted && "opacity-70 italic"
          )}
          style={isOutgoing ? { background: platformColor } : undefined}
        >
          {/* Deleted badge */}
          {message.is_deleted && (
            <span className="inline-flex items-center gap-1 text-xs opacity-80 mb-1">
              <Trash2 className="h-3 w-3" /> This message was deleted
            </span>
          )}

          {/* Text body */}
          {!message.is_deleted && message.body && (
            <p className="whitespace-pre-wrap">{highlightText(message.body, searchQuery)}</p>
          )}

          {/* Media content */}
          {!message.is_deleted && message.message_type !== 'text' && (
            <MediaContent message={message} isOutgoing={isOutgoing} />
          )}
        </div>

        {/* Timestamp */}
        <span className={cn("text-[10px] mt-1 px-1 text-slate-400 dark:text-slate-500")}>
          {formatMsgTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}

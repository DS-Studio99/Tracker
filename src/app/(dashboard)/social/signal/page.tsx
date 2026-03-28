import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Signal Messages | Tracker Dashboard" }

export default function SignalPage() {
  return (
    <SocialChatPage
      platform="signal"
      platformName="Signal"
      platformIcon="🔒"
      platformColor="#3A76F0"
    />
  )
}

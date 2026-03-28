import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Kik Messages | Tracker Dashboard" }

export default function KikPage() {
  return (
    <SocialChatPage
      platform="kik"
      platformName="Kik"
      platformIcon="💬"
      platformColor="#82BC23"
    />
  )
}

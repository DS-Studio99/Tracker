import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "IMO Messages | Tracker Dashboard" }

export default function ImoPage() {
  return (
    <SocialChatPage
      platform="imo"
      platformName="IMO"
      platformIcon="💬"
      platformColor="#005FFF"
    />
  )
}

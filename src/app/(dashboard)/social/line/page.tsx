import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "LINE Messages | Tracker Dashboard" }

export default function LinePage() {
  return (
    <SocialChatPage
      platform="line"
      platformName="LINE"
      platformIcon="🟢"
      platformColor="#00C300"
    />
  )
}

import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Viber Messages | Tracker Dashboard" }

export default function ViberPage() {
  return (
    <SocialChatPage
      platform="viber"
      platformName="Viber"
      platformIcon="📱"
      platformColor="#665CAC"
    />
  )
}

import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Telegram Messages | Tracker Dashboard" }

export default function TelegramPage() {
  return (
    <SocialChatPage
      platform="telegram"
      platformName="Telegram"
      platformIcon="✈️"
      platformColor="#0088CC"
    />
  )
}

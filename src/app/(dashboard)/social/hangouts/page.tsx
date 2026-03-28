import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Hangouts Messages | Tracker Dashboard" }

export default function HangoutsPage() {
  return (
    <SocialChatPage
      platform="hangouts"
      platformName="Hangouts"
      platformIcon="🟢"
      platformColor="#0F9D58"
    />
  )
}

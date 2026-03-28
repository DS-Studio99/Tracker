import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Discord Messages | Tracker Dashboard" }

export default function DiscordPage() {
  return (
    <SocialChatPage
      platform="discord"
      platformName="Discord"
      platformIcon="🎮"
      platformColor="#5865F2"
    />
  )
}

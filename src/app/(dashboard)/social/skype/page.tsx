import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "Skype Messages | Tracker Dashboard" }

export default function SkypePage() {
  return (
    <SocialChatPage
      platform="skype"
      platformName="Skype"
      platformIcon="💀"
      platformColor="#00AFF0"
    />
  )
}

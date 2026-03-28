import { SocialChatPage } from "@/components/dashboard/social-chat-page"

export const metadata = { title: "WeChat Messages | Tracker Dashboard" }

export default function WeChatPage() {
  return (
    <SocialChatPage
      platform="wechat"
      platformName="WeChat"
      platformIcon="🟢"
      platformColor="#7BB32E"
    />
  )
}

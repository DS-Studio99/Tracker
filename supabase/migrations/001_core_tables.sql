-- =========================================================================
-- MIGRATION 001: CORE TABLES FOR MOBILE TRACKER DASHBOARD
-- =========================================================================

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create devices table
CREATE TABLE IF NOT EXISTS public.devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    device_name TEXT NOT NULL,
    device_model TEXT,
    android_version TEXT,
    imei TEXT,
    phone_number TEXT,
    sim_operator TEXT,
    sim_serial TEXT,
    mac_address TEXT,
    battery_level INTEGER DEFAULT 0,
    is_charging BOOLEAN DEFAULT false,
    storage_total BIGINT,
    storage_used BIGINT,
    ram_total BIGINT,
    ram_used BIGINT,
    is_online BOOLEAN DEFAULT false,
    last_seen TIMESTAMPTZ,
    app_version TEXT,
    device_token TEXT UNIQUE,
    is_rooted BOOLEAN DEFAULT false,
    screen_status TEXT DEFAULT 'off',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create sms_messages table
CREATE TABLE IF NOT EXISTS public.sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    message_type TEXT NOT NULL CHECK (message_type IN ('incoming', 'outgoing', 'draft')),
    sender_name TEXT,
    sender_number TEXT NOT NULL,
    receiver_name TEXT,
    receiver_number TEXT,
    body TEXT,
    is_mms BOOLEAN DEFAULT false,
    mms_attachment_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMPTZ NOT NULL,
    is_read BOOLEAN DEFAULT false,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Create call_logs table
CREATE TABLE IF NOT EXISTS public.call_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    call_type TEXT NOT NULL CHECK (call_type IN ('incoming', 'outgoing', 'missed', 'rejected', 'blocked')),
    contact_name TEXT,
    phone_number TEXT NOT NULL,
    duration INTEGER DEFAULT 0,
    recording_url TEXT,
    recording_duration INTEGER,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    timestamp TIMESTAMPTZ NOT NULL,
    is_deleted BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    altitude DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    bearing DOUBLE PRECISION,
    address TEXT,
    provider TEXT,
    battery_level INTEGER,
    is_mock BOOLEAN DEFAULT false,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE NOT NULL,
    contact_name TEXT,
    phone_numbers JSONB,
    emails JSONB,
    photo_url TEXT,
    organization TEXT,
    notes TEXT,
    is_deleted BOOLEAN DEFAULT false,
    last_modified TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================================================================
-- CREATE INDEXES
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_sms_device_timestamp ON public.sms_messages(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_calls_device_timestamp ON public.call_logs(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_locations_device_timestamp ON public.locations(device_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_contacts_device ON public.contacts(device_id);
CREATE INDEX IF NOT EXISTS idx_devices_user ON public.devices(user_id);
CREATE INDEX IF NOT EXISTS idx_devices_token ON public.devices(device_token);


-- =========================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- =========================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;


-- =========================================================================
-- RLS POLICIES FOR PROFILES & DEVICES
-- =========================================================================

-- Profiles
CREATE POLICY "Users view own profile" 
ON public.profiles FOR SELECT TO authenticated 
USING (auth.uid() = id);

CREATE POLICY "Users update own profile" 
ON public.profiles FOR UPDATE TO authenticated 
USING (auth.uid() = id);

-- Devices
CREATE POLICY "Users manage own devices" 
ON public.devices FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);


-- =========================================================================
-- RLS POLICIES FOR DEVICE DATA (Users access their own device data)
-- =========================================================================

-- SMS Messages
CREATE POLICY "Users view own sms" 
ON public.sms_messages FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access sms" 
ON public.sms_messages FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Call Logs
CREATE POLICY "Users view own calls" 
ON public.call_logs FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access calls" 
ON public.call_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Locations
CREATE POLICY "Users view own locations" 
ON public.locations FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access locations" 
ON public.locations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contacts
CREATE POLICY "Users view own contacts" 
ON public.contacts FOR ALL TO authenticated 
USING (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()))
WITH CHECK (device_id IN (SELECT id FROM public.devices WHERE user_id = auth.uid()));

CREATE POLICY "Service role full access contacts" 
ON public.contacts FOR ALL TO service_role USING (true) WITH CHECK (true);


-- =========================================================================
-- TRIGGERS & FUNCTIONS
-- =========================================================================

-- Function: create profile entry when a new auth user is registered
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE(NEW.raw_user_meta_data->>'role', 'user')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Execute function on user registration
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ENABLE REALTIME ON REQUIRED TABLES
-- ============================================================
-- Run this in Supabase Dashboard > SQL Editor > New Query
-- This enables real-time change notifications for these tables.
-- ============================================================

-- Core tracking tables
ALTER PUBLICATION supabase_realtime ADD TABLE devices;
ALTER PUBLICATION supabase_realtime ADD TABLE remote_commands;
ALTER PUBLICATION supabase_realtime ADD TABLE locations;
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE sms_messages;

-- Additional tables (optional, enable as needed)
ALTER PUBLICATION supabase_realtime ADD TABLE call_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE keylogger_events;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE social_messages;

-- ============================================================
-- NOTE: After enabling realtime, verify via:
-- SELECT * FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime';
-- ============================================================

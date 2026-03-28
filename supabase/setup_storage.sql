-- ============================================================
-- STORAGE SETUP FOR MOBILE TRACKER DASHBOARD
-- ============================================================
-- STEP 1: Create the following buckets via Supabase Dashboard > Storage > New Bucket:
--
--   Bucket Name           | Public | Max File Size
--   ----------------------|--------|---------------
--   call-recordings       | No     | 50 MB
--   media                 | No     | 100 MB
--   screenshots           | No     | 20 MB
--   ambient-recordings    | No     | 50 MB
--   avatars               | Yes    | 5 MB
--   app-icons             | Yes    | 2 MB
--   files                 | No     | 200 MB
--
-- STEP 2: Run the SQL below in the Supabase SQL Editor (Dashboard > SQL Editor > New Query)
-- ============================================================

-- ============================================================
-- STORAGE POLICIES: Private Buckets (device-scoped access)
-- ============================================================

-- Allow authenticated users to upload files into their own device folders
CREATE POLICY "Authenticated users can upload to their device folders"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
    bucket_id IN ('call-recordings', 'media', 'screenshots', 'ambient-recordings', 'files')
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM devices WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to view files from their own device folders
CREATE POLICY "Authenticated users can view their device files"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id IN ('call-recordings', 'media', 'screenshots', 'ambient-recordings', 'files')
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM devices WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to update files in their own device folders
CREATE POLICY "Authenticated users can update their device files"
ON storage.objects FOR UPDATE TO authenticated
USING (
    bucket_id IN ('call-recordings', 'media', 'screenshots', 'ambient-recordings', 'files')
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM devices WHERE user_id = auth.uid()
    )
);

-- Allow authenticated users to delete files from their own device folders
CREATE POLICY "Authenticated users can delete their device files"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id IN ('call-recordings', 'media', 'screenshots', 'ambient-recordings', 'files')
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM devices WHERE user_id = auth.uid()
    )
);

-- Service role has full access to all storage objects (for server-side operations)
CREATE POLICY "Service role can manage all files"
ON storage.objects FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- ============================================================
-- STORAGE POLICIES: Public Buckets (avatars & app-icons)
-- ============================================================

-- Anyone (including unauthenticated) can view public bucket files
CREATE POLICY "Anyone can view public files"
ON storage.objects FOR SELECT TO public
USING (bucket_id IN ('avatars', 'app-icons'));

-- Authenticated users can upload to public buckets
CREATE POLICY "Authenticated can upload avatars"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('avatars', 'app-icons'));

-- Authenticated users can update their own avatar/icon uploads
CREATE POLICY "Authenticated can update their avatars"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id IN ('avatars', 'app-icons') AND owner = auth.uid());

-- Authenticated users can delete their own avatar/icon uploads
CREATE POLICY "Authenticated can delete their avatars"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id IN ('avatars', 'app-icons') AND owner = auth.uid());

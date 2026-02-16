-- Disable RLS on maintenance_timeline to allow inserts from the application
-- (Since the app uses custom auth, the 'authenticated' role might not be set for Supabase RLS)
ALTER TABLE public.maintenance_timeline DISABLE ROW LEVEL SECURITY;

-- Alternatively, allow anonymous inserts if RLS must be kept:
-- CREATE POLICY "Allow anon insert" ON public.maintenance_timeline FOR INSERT WITH CHECK (true);

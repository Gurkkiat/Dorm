-- Create the maintenance_timeline table to track history of updates
CREATE TABLE IF NOT EXISTS public.maintenance_timeline (
  id SERIAL PRIMARY KEY,
  request_id INTEGER NOT NULL REFERENCES public.maintenance_request(id) ON DELETE CASCADE,
  technician_id INTEGER REFERENCES public.users(id),
  status TEXT NOT NULL,
  comment TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optional: Enable RLS
ALTER TABLE public.maintenance_timeline ENABLE ROW LEVEL SECURITY;

-- Allow read access to everyone (or specific roles)
CREATE POLICY "Allow read access for all users" ON public.maintenance_timeline
  FOR SELECT USING (true);

-- Allow insert access for authenticated users (mechanics)
CREATE POLICY "Allow insert access for authenticated users" ON public.maintenance_timeline
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

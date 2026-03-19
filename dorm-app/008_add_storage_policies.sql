-- Migration: 008_add_storage_policies
-- Purpose: Adds the required Role Level Security (RLS) policies to allow image uploads to the "expenses" bucket.

-- Enable access to everyone for the 'expenses' bucket (since it's an internal admin tool, allowing public isn't a huge risk, or you can restrict it to auth.role() = 'authenticated')

-- 1. Allow Inserting Files to the bucket
CREATE POLICY "Allow public insert to expenses" 
ON storage.objects FOR INSERT 
WITH CHECK (bucket_id = 'expenses');

-- 2. Allow Reading Files from the bucket (redundant if bucket is Public, but good for explicit API selects)
CREATE POLICY "Allow public select from expenses" 
ON storage.objects FOR SELECT 
USING (bucket_id = 'expenses');

-- 3. Allow Updating Files (if someone replaces an image)
CREATE POLICY "Allow public update to expenses" 
ON storage.objects FOR UPDATE 
USING (bucket_id = 'expenses');

-- 4. Allow Deleting Files (optional, if you want users to be able to delete images)
CREATE POLICY "Allow public delete from expenses" 
ON storage.objects FOR DELETE 
USING (bucket_id = 'expenses');

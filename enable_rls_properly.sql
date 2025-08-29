-- Re-enable RLS and fix the policies properly
-- Run this in Supabase SQL Editor

-- First, enable RLS
ALTER TABLE chat_records ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own chat records" ON chat_records;
DROP POLICY IF EXISTS "Users can insert their own chat records" ON chat_records;
DROP POLICY IF EXISTS "Users can update their own chat records" ON chat_records;
DROP POLICY IF EXISTS "Users can delete their own chat records" ON chat_records;

-- Create simple policies that work with our current setup
-- Since we're not using Clerk JWT tokens in the database, we'll create permissive policies for now

-- Allow all authenticated users to do everything (for development)
CREATE POLICY "Allow all for authenticated users" ON chat_records
    FOR ALL 
    TO authenticated 
    USING (true) 
    WITH CHECK (true);

-- Or if you want user-specific access, create policies based on user_id column:
-- CREATE POLICY "Users can manage their records" ON chat_records
--     FOR ALL 
--     USING (user_id = current_setting('app.current_user_id', true))
--     WITH CHECK (user_id = current_setting('app.current_user_id', true));

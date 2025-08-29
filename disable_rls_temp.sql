-- TEMPORARY: Disable RLS for testing
-- Run this in Supabase SQL editor to test functionality
-- Re-enable RLS after testing!

ALTER TABLE chat_records DISABLE ROW LEVEL SECURITY;

-- After testing works, re-enable with:
-- ALTER TABLE chat_records ENABLE ROW LEVEL SECURITY;

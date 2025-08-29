-- AutoMBS Database Schema
-- Run this in your Supabase SQL Editor

-- Create chat_records table
CREATE TABLE IF NOT EXISTS chat_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    patient_info JSONB NOT NULL,
    chat_messages JSONB NOT NULL,
    final_codes JSONB NOT NULL,
    report_generated BOOLEAN DEFAULT FALSE,
    report_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for user queries
CREATE INDEX IF NOT EXISTS idx_chat_records_user_id ON chat_records(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_records_created_at ON chat_records(created_at DESC);

-- Enable Row Level Security
ALTER TABLE chat_records ENABLE ROW LEVEL SECURITY;

-- Create policies for different operations
CREATE POLICY "Users can view their own chat records" ON chat_records
    FOR SELECT USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can insert their own chat records" ON chat_records
    FOR INSERT WITH CHECK (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can update their own chat records" ON chat_records
    FOR UPDATE USING (user_id = auth.jwt() ->> 'sub');

CREATE POLICY "Users can delete their own chat records" ON chat_records
    FOR DELETE USING (user_id = auth.jwt() ->> 'sub');

-- Create a function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_chat_records_updated_at 
    BEFORE UPDATE ON chat_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Sample data structure for reference:
/*
patient_info structure:
{
  "name": "John Doe",
  "age": 45,
  "sex": "male",
  "setting": "GP",
  "clinician_role": "GP",
  "clinical_notes": "Patient presents with...",
  "uploaded_files": [],
  "encounter_date": "2025-01-28T10:30:00.000Z"
}

chat_messages structure:
[
  {
    "id": "1",
    "role": "user",
    "content": "Analyzing clinical notes...",
    "timestamp": "2025-01-28T10:30:00.000Z"
  },
  {
    "id": "2", 
    "role": "assistant",
    "content": "Based on your clinical notes...",
    "timestamp": "2025-01-28T10:30:05.000Z"
  }
]

final_codes structure:
[
  {
    "item_number": "5012",
    "title": "Complexity More than Ordinary...",
    "confidence": 0.85,
    "reasoning": "Multiple investigations required",
    "evidence": ["CT scan ordered", "Specialist referral"],
    "schedule_fee": 89.15
  }
]
*/

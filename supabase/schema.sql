-- AutoMBS Database Schema
-- This schema defines the core tables for the AutoMBS medical coding application

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Coding Records table
-- Stores clinical notes, AI suggestions, and confirmed codes
CREATE TABLE IF NOT EXISTS coding_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL, -- Clerk user ID
  patient_name TEXT NOT NULL,
  patient_id TEXT, -- Optional patient identifier
  clinical_notes TEXT NOT NULL,
  suggested_codes JSONB DEFAULT '[]'::jsonb, -- AI suggested MBS codes with confidence scores
  confirmed_codes JSONB DEFAULT '[]'::jsonb, -- User confirmed codes
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'in_review', 'completed')),
  accuracy_score DECIMAL(3,2), -- Overall accuracy score if available
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- MBS Codes reference table (for quick lookups)
CREATE TABLE IF NOT EXISTS mbs_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- MBS item number
  description TEXT NOT NULL,
  category TEXT, -- e.g., 'GP_CONSULT', 'EMERGENCY', 'PATHOLOGY'
  fee DECIMAL(10,2), -- Schedule fee
  eligibility_rules JSONB, -- Rules for when this code applies
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Coding Sessions table (for tracking user workflow)
CREATE TABLE IF NOT EXISTS coding_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  coding_record_id UUID REFERENCES coding_records(id) ON DELETE CASCADE,
  session_data JSONB, -- Store session state, chat history, etc.
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_coding_records_user_id ON coding_records(user_id);
CREATE INDEX IF NOT EXISTS idx_coding_records_status ON coding_records(status);
CREATE INDEX IF NOT EXISTS idx_coding_records_created_at ON coding_records(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mbs_codes_code ON mbs_codes(code);
CREATE INDEX IF NOT EXISTS idx_mbs_codes_category ON mbs_codes(category);
CREATE INDEX IF NOT EXISTS idx_coding_sessions_user_id ON coding_sessions(user_id);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to coding_records
CREATE TRIGGER update_coding_records_updated_at 
  BEFORE UPDATE ON coding_records 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE coding_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE coding_sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own records
CREATE POLICY "Users can view their own coding records" 
  ON coding_records FOR SELECT 
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own coding records" 
  ON coding_records FOR INSERT 
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own coding records" 
  ON coding_records FOR UPDATE 
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can delete their own coding records" 
  ON coding_records FOR DELETE 
  USING (user_id = current_setting('app.current_user_id', true));

-- Similar policies for coding_sessions
CREATE POLICY "Users can view their own coding sessions" 
  ON coding_sessions FOR SELECT 
  USING (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can insert their own coding sessions" 
  ON coding_sessions FOR INSERT 
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

CREATE POLICY "Users can update their own coding sessions" 
  ON coding_sessions FOR UPDATE 
  USING (user_id = current_setting('app.current_user_id', true));

-- MBS codes are readable by all authenticated users
CREATE POLICY "Authenticated users can view MBS codes" 
  ON mbs_codes FOR SELECT 
  TO authenticated 
  USING (true);

-- Insert some sample MBS codes for testing
INSERT INTO mbs_codes (code, description, category, fee) VALUES
('23', 'Level A consultation', 'GP_CONSULT', 39.75),
('36', 'Level B consultation', 'GP_CONSULT', 79.30),
('44', 'Level C consultation', 'GP_CONSULT', 119.20),
('104', 'Emergency department consultation - Category 1', 'EMERGENCY', 89.15),
('105', 'Emergency department consultation - Category 2', 'EMERGENCY', 134.85),
('106', 'Emergency department consultation - Category 3', 'EMERGENCY', 199.50),
('5000', 'Full blood count', 'PATHOLOGY', 16.95),
('5001', 'Haemoglobin', 'PATHOLOGY', 8.50),
('14255', 'Simple wound repair', 'MINOR_PROCEDURE', 89.15),
('14256', 'Intermediate wound repair', 'MINOR_PROCEDURE', 134.85)
ON CONFLICT (code) DO NOTHING;

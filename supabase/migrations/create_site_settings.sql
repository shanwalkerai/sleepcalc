/*
  # Create site_settings table

  This migration creates the `site_settings` table to store key-value configuration
  data for the website.

  1. New Tables
     - `site_settings`
       - `key` (text, primary key): The unique identifier for the setting.
       - `value` (jsonb): The value of the setting, stored as JSONB for flexibility.
       - `created_at` (timestamptz): Timestamp of creation.
       - `updated_at` (timestamptz): Timestamp of last update.

  2. Security
     - Enable RLS on `site_settings` table.
     - **INSECURE POLICY (Development Only):** Add policy allowing anonymous users full access (SELECT, INSERT, UPDATE, DELETE). This MUST be replaced with authenticated policies in production.

  3. Triggers
     - Add a trigger to automatically update the `updated_at` timestamp when a row is modified.
*/

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create site_settings table
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS set_timestamp ON site_settings; -- Ensure trigger doesn't already exist
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON site_settings
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- Enable Row Level Security
ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

-- Grant usage on schema to anon role if not already done (often default)
-- GRANT USAGE ON SCHEMA public TO anon;

-- Grant permissions to anon role
-- GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE site_settings TO anon;

-- Drop existing policies if they exist (optional, for idempotency)
DROP POLICY IF EXISTS "Allow anon full access on site_settings" ON site_settings;

-- **WARNING: INSECURE POLICY FOR DEVELOPMENT ONLY**
-- Allows anonymous users to read, insert, update, and delete settings.
-- Replace with authenticated policies before production.
CREATE POLICY "Allow anon full access on site_settings"
  ON site_settings
  FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
  TO anon -- The anonymous role
  USING (true) -- Allows access to all rows for SELECT/UPDATE/DELETE
  WITH CHECK (true); -- Allows all INSERTs/UPDATEs

COMMENT ON POLICY "Allow anon full access on site_settings" ON site_settings IS 'WARNING: Insecure policy for development. Grants full CRUD access to anonymous users. Replace with authenticated policies.';

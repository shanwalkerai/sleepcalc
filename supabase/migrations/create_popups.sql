/*
        # Create popups table

        This migration creates the `popups` table to store announcement or
        promotional popups for the website.

        1. New Tables
           - `popups`
             - `id` (uuid, primary key): Unique identifier for the popup.
             - `message` (text, not null): The content of the popup (can be HTML).
             - `start_time` (timestamptz): When the popup should start appearing (optional).
             - `end_time` (timestamptz): When the popup should stop appearing (optional).
             - `is_active` (boolean, default true): Whether the popup is currently enabled.
             - `created_at` (timestamptz): Timestamp of creation.
             - `updated_at` (timestamptz): Timestamp of last update.

        2. Indexes
           - Add index on `is_active`, `start_time`, `end_time` for querying active popups.

        3. Security
           - Enable RLS on `popups` table.
           - **INSECURE POLICY (Development Only):** Allow anonymous full access. Replace later.

        4. Triggers
           - Use the existing `trigger_set_timestamp()` function for `updated_at`.
      */

      -- Create popups table
      CREATE TABLE IF NOT EXISTS popups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message TEXT NOT NULL,
        start_time TIMESTAMPTZ,
        end_time TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Create index for querying active popups
      CREATE INDEX IF NOT EXISTS idx_popups_active ON popups(is_active, start_time, end_time);

      -- Add trigger for updated_at
      DROP TRIGGER IF EXISTS set_timestamp ON popups;
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON popups
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();

      -- Enable Row Level Security
      ALTER TABLE popups ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Allow anon full access on popups" ON popups;

      -- **WARNING: INSECURE POLICY FOR DEVELOPMENT ONLY**
      CREATE POLICY "Allow anon full access on popups"
        ON popups
        FOR ALL
        TO anon
        USING (true)
        WITH CHECK (true);

      COMMENT ON POLICY "Allow anon full access on popups" ON popups IS 'WARNING: Insecure policy for development. Grants full CRUD access to anonymous users. Replace with authenticated admin policies.';
      COMMENT ON COLUMN popups.message IS 'Content of the popup, can include HTML.';
      COMMENT ON COLUMN popups.start_time IS 'Timestamp when the popup becomes active (optional).';
      COMMENT ON COLUMN popups.end_time IS 'Timestamp when the popup expires (optional).';
      COMMENT ON COLUMN popups.is_active IS 'Whether the popup is currently enabled.';

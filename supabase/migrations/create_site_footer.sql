/*
        # Create site_footer table

        This migration creates the `site_footer` table to store footer link items.
        General footer text (like copyright) should be stored in `site_settings`.

        1. New Tables
           - `site_footer`
             - `id` (uuid, primary key): Unique identifier for the footer link.
             - `title` (text, not null): The text displayed for the link.
             - `url` (text, not null): The URL the link points to.
             - `order` (integer, default 0): Determines the display order.
             - `created_at` (timestamptz): Timestamp of creation.
             - `updated_at` (timestamptz): Timestamp of last update.

        2. Indexes
           - Add index on `order` for sorting.

        3. Security
           - Enable RLS on `site_footer` table.
           - **INSECURE POLICY (Development Only):** Allow anonymous full access. Replace later.

        4. Triggers
           - Use the existing `trigger_set_timestamp()` function for `updated_at`.
      */

      -- Create site_footer table
      CREATE TABLE IF NOT EXISTS site_footer (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        "order" INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Create index on order
      CREATE INDEX IF NOT EXISTS idx_site_footer_order ON site_footer("order");

      -- Add trigger for updated_at
      DROP TRIGGER IF EXISTS set_timestamp ON site_footer;
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON site_footer
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();

      -- Enable Row Level Security
      ALTER TABLE site_footer ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Allow anon full access on site_footer" ON site_footer;

      -- **WARNING: INSECURE POLICY FOR DEVELOPMENT ONLY**
      CREATE POLICY "Allow anon full access on site_footer"
        ON site_footer
        FOR ALL
        TO anon
        USING (true)
        WITH CHECK (true);

      COMMENT ON POLICY "Allow anon full access on site_footer" ON site_footer IS 'WARNING: Insecure policy for development. Grants full CRUD access to anonymous users. Replace with authenticated admin policies.';
      COMMENT ON COLUMN site_footer."order" IS 'Display order for footer links (lower numbers first).';

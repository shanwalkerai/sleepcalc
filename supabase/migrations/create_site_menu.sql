/*
        # Create site_menu table

        This migration creates the `site_menu` table to store the main navigation
        menu items for the website.

        1. New Tables
           - `site_menu`
             - `id` (uuid, primary key): Unique identifier for the menu item.
             - `title` (text, not null): The text displayed for the menu item.
             - `url` (text, not null): The URL the menu item links to.
             - `order` (integer, default 0): Determines the display order of items. Lower numbers appear first.
             - `created_at` (timestamptz): Timestamp of creation.
             - `updated_at` (timestamptz): Timestamp of last update.

        2. Indexes
           - Add index on `order` for sorting.

        3. Security
           - Enable RLS on `site_menu` table.
           - **INSECURE POLICY (Development Only):** Add policy allowing anonymous users full access (SELECT, INSERT, UPDATE, DELETE). Replace with authenticated admin policies later.

        4. Triggers
           - Use the existing `trigger_set_timestamp()` function for `updated_at`.
      */

      -- Create site_menu table
      CREATE TABLE IF NOT EXISTS site_menu (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        url TEXT NOT NULL,
        "order" INTEGER DEFAULT 0, -- Use quotes for reserved keyword 'order'
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Create index on order
      CREATE INDEX IF NOT EXISTS idx_site_menu_order ON site_menu("order");

      -- Add trigger for updated_at (assuming trigger_set_timestamp function exists)
      DROP TRIGGER IF EXISTS set_timestamp ON site_menu;
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON site_menu
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();

      -- Enable Row Level Security
      ALTER TABLE site_menu ENABLE ROW LEVEL SECURITY;

      -- Drop existing policies if they exist
      DROP POLICY IF EXISTS "Allow anon full access on site_menu" ON site_menu;

      -- **WARNING: INSECURE POLICY FOR DEVELOPMENT ONLY**
      CREATE POLICY "Allow anon full access on site_menu"
        ON site_menu
        FOR ALL
        TO anon
        USING (true)
        WITH CHECK (true);

      COMMENT ON POLICY "Allow anon full access on site_menu" ON site_menu IS 'WARNING: Insecure policy for development. Grants full CRUD access to anonymous users. Replace with authenticated admin policies.';
      COMMENT ON COLUMN site_menu."order" IS 'Display order for menu items (lower numbers first).';

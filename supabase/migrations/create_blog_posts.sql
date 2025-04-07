/*
      # Create blog_posts table

      This migration creates the `blog_posts` table to store blog articles.

      1. New Tables
         - `blog_posts`
           - `id` (uuid, primary key): Unique identifier for the post.
           - `title` (text, not null): The main title of the blog post.
           - `slug` (text, unique, not null): URL-friendly identifier for the post.
           - `content` (text): The main body content of the post (HTML or Markdown).
           - `image_url` (text): URL for the featured image.
           - `meta_title` (text): Custom title for SEO purposes (defaults to title).
           - `meta_description` (text): Custom description for SEO.
           - `keywords` (text[]): Array of keywords for SEO.
           - `status` (text, default 'draft'): Publication status (e.g., draft, published).
           - `created_at` (timestamptz): Timestamp of creation.
           - `updated_at` (timestamptz): Timestamp of last update.

      2. Indexes
         - Add index on `slug` for faster lookups.
         - Add index on `status` for filtering.

      3. Security
         - Enable RLS on `blog_posts` table.
         - **INSECURE POLICY (Development Only):** Add policy allowing anonymous users full access (SELECT, INSERT, UPDATE, DELETE). This MUST be replaced with authenticated policies in production.

      4. Triggers
         - Add a trigger to automatically update the `updated_at` timestamp when a row is modified.
    */

    -- Ensure the timestamp function exists (might be created in another migration)
    CREATE OR REPLACE FUNCTION trigger_set_timestamp()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    -- Create blog_posts table
    CREATE TABLE IF NOT EXISTS blog_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      content TEXT,
      image_url TEXT,
      meta_title TEXT,
      meta_description TEXT,
      keywords TEXT[],
      status TEXT DEFAULT 'draft', -- Added status column here
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    -- Create index on slug
    CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);

    -- Create index on status
    CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

    -- Add trigger for updated_at
    DROP TRIGGER IF EXISTS set_timestamp ON blog_posts; -- Ensure trigger doesn't already exist
    CREATE TRIGGER set_timestamp
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW
    EXECUTE FUNCTION trigger_set_timestamp();

    -- Enable Row Level Security
    ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if they exist (optional, for idempotency)
    DROP POLICY IF EXISTS "Allow anon full access on blog_posts" ON blog_posts;

    -- **WARNING: INSECURE POLICY FOR DEVELOPMENT ONLY**
    -- Allows anonymous users to read, insert, update, and delete posts.
    -- Replace with authenticated policies before production.
    CREATE POLICY "Allow anon full access on blog_posts"
      ON blog_posts
      FOR ALL -- Applies to SELECT, INSERT, UPDATE, DELETE
      TO anon -- The anonymous role
      USING (true) -- Allows access to all rows for SELECT/UPDATE/DELETE
      WITH CHECK (true); -- Allows all INSERTs/UPDATEs

    COMMENT ON POLICY "Allow anon full access on blog_posts" ON blog_posts IS 'WARNING: Insecure policy for development. Grants full CRUD access to anonymous users. Replace with authenticated policies.';
    COMMENT ON COLUMN blog_posts.status IS 'Publication status of the blog post (e.g., draft, published)';

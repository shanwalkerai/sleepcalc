/*
        # Add status column to blog_posts

        This migration adds a status column to the blog_posts table to allow
        distinguishing between draft and published posts.

        1. Changes
           - Add `status` column (TEXT) to `blog_posts` table.
           - Set default value for `status` to 'draft'.
           - Add an index on the `status` column for potential filtering.

        2. Security
           - Existing RLS policies remain unchanged. The insecure "anon full access" policy still applies for now.
      */

      -- Add the status column with a default value
      ALTER TABLE blog_posts
      ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';

      -- Add an index for filtering by status
      CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts(status);

      COMMENT ON COLUMN blog_posts.status IS 'Publication status of the blog post (e.g., draft, published)';

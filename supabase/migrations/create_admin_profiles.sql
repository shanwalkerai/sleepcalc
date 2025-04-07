/*
        # Create admin_profiles table

        This migration creates the `admin_profiles` table to store additional
        information for administrative users, linking to the core Supabase authentication system.

        1. New Tables
           - `admin_profiles`
             - `id` (uuid, primary key): References `auth.users.id`. Stores the user's unique ID from Supabase Auth.
             - `display_name` (text): A user-settable display name for the admin panel. Defaults to 'Admin User'.
             - `created_at` (timestamptz): Timestamp of profile creation.
             - `updated_at` (timestamptz): Timestamp of last profile update.

        2. Relationships
           - Establishes a foreign key constraint between `admin_profiles.id` and `auth.users.id`. Ensures that every admin profile corresponds to a valid authenticated user. Includes `ON DELETE CASCADE` so if a user is deleted from `auth.users`, their corresponding profile is also removed.

        3. Functions
           - Creates the `trigger_set_timestamp()` function to automatically update `updated_at` columns.

        4. Security
           - Enables Row Level Security (RLS) on the `admin_profiles` table.
           - Adds policies:
             - Authenticated users can view their own profile.
             - Authenticated users can insert their own profile.
             - Authenticated users can update their own profile.
             - Deleting profiles is disallowed by default (no DELETE policy).

        5. Triggers
           - Uses the `trigger_set_timestamp()` function to automatically update the `updated_at` column on modification.
      */

      -- Function to update updated_at timestamp (Define it here)
      CREATE OR REPLACE FUNCTION trigger_set_timestamp()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      -- Create admin_profiles table
      CREATE TABLE IF NOT EXISTS admin_profiles (
        id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
        display_name TEXT DEFAULT 'Admin User',
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      );

      -- Add trigger for updated_at using the function
      DROP TRIGGER IF EXISTS set_timestamp ON admin_profiles; -- Ensure trigger doesn't already exist
      CREATE TRIGGER set_timestamp
      BEFORE UPDATE ON admin_profiles
      FOR EACH ROW
      EXECUTE FUNCTION trigger_set_timestamp();

      -- Enable Row Level Security
      ALTER TABLE admin_profiles ENABLE ROW LEVEL SECURITY;

      -- Policies for admin_profiles
      DROP POLICY IF EXISTS "Allow authenticated users to view own profile" ON admin_profiles;
      CREATE POLICY "Allow authenticated users to view own profile"
        ON admin_profiles
        FOR SELECT
        TO authenticated
        USING (auth.uid() = id);

      DROP POLICY IF EXISTS "Allow authenticated users to insert own profile" ON admin_profiles;
      CREATE POLICY "Allow authenticated users to insert own profile"
        ON admin_profiles
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid() = id);

      DROP POLICY IF EXISTS "Allow authenticated users to update own profile" ON admin_profiles;
      CREATE POLICY "Allow authenticated users to update own profile"
        ON admin_profiles
        FOR UPDATE
        TO authenticated
        USING (auth.uid() = id)
        WITH CHECK (auth.uid() = id);

      COMMENT ON TABLE admin_profiles IS 'Stores additional profile information for admin users, linked to auth.users.';
      COMMENT ON POLICY "Allow authenticated users to view own profile" ON admin_profiles IS 'Authenticated users can select their own profile.';
      COMMENT ON POLICY "Allow authenticated users to insert own profile" ON admin_profiles IS 'Authenticated users can insert their own profile.';
      COMMENT ON POLICY "Allow authenticated users to update own profile" ON admin_profiles IS 'Authenticated users can update their own profile.';

import { createClient } from '@supabase/supabase-js'

// Ensure your environment variables are correctly loaded
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Supabase URL or Anon Key is missing. Make sure .env file is set up correctly and variables start with VITE_");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Example of how to check connection (optional)
async function checkSupabaseConnection() {
  try {
    // Try fetching a small amount of data, e.g., list tables (requires permissions)
    // Or perform a simple query on a known public table if available
    // For now, we just assume the client initializes if keys are present.
    if(supabase) {
        console.log("Supabase client initialized successfully.");
        // Example: Fetching user (will be null if not logged in)
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
          // Handle specific auth errors if needed, but don't throw for connection check
          console.warn("Could not fetch user (this is expected if not logged in):", error.message);
        } else {
          console.log("Successfully performed a basic check with Supabase auth.");
        }
        // You could also try a simple query if you have a public table
        // const { error: queryError } = await supabase.from('your_public_table').select('id').limit(1);
        // if (queryError) console.error("Error performing test query:", queryError);
        // else console.log("Successfully performed a test query.");

    } else {
       console.error("Supabase client failed to initialize.");
    }
  } catch (error) {
    console.error("Error connecting to Supabase:", error);
  }
}

checkSupabaseConnection(); // Call this if you want to test connection on load

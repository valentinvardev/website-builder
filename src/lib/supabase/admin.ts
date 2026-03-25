import { createClient } from "@supabase/supabase-js";
import { env } from "~/env";

/**
 * Admin / service-role Supabase client.
 * Bypasses Row Level Security — ONLY use in trusted server-side contexts
 * (e.g. background jobs, server actions that need elevated privileges).
 * NEVER expose this client to the browser.
 */
export const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

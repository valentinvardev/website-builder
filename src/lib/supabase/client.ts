import { createBrowserClient } from "@supabase/auth-helpers-nextjs";

/**
 * Browser-side (Client Component) Supabase client.
 * Returns a singleton per browser session — safe to call on every render.
 *
 * Usage:
 *   "use client";
 *   import { createClient } from "~/lib/supabase/client";
 *   const supabase = createClient();
 *   const { data } = await supabase.from("table").select();
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

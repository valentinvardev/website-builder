import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for Server Components and Route Handlers.
 * Reads & writes session cookies using the App Router `cookies()` API.
 *
 * Usage (inside an async Server Component or Route Handler):
 *   import { createClient } from "~/lib/supabase/server";
 *   const supabase = createClient();
 *   const { data } = await supabase.from("table").select();
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // setAll is called from Server Components where setting cookies
            // is a no-op. Middleware handles session refresh instead.
          }
        },
      },
    },
  );
}

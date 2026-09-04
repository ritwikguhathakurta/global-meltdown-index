import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL_FALLBACK, SUPABASE_ANON_KEY_FALLBACK } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    SUPABASE_URL_FALLBACK,
    SUPABASE_ANON_KEY_FALLBACK,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component render; middleware refreshes the session instead
          }
        },
      },
    }
  );
}

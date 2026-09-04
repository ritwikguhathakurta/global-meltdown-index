import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL_FALLBACK, SUPABASE_ANON_KEY_FALLBACK } from "./config";

export function createClient() {
  return createBrowserClient(SUPABASE_URL_FALLBACK, SUPABASE_ANON_KEY_FALLBACK);
}

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL_FALLBACK } from "./config";

/**
 * Service-role client. Bypasses RLS — only ever import this inside
 * server-only code (cron routes, admin API routes). Never expose
 * SUPABASE_SERVICE_ROLE_KEY to the client bundle.
 */
export function createAdminClient() {
  return createSupabaseClient(SUPABASE_URL_FALLBACK, process.env.SUPABASE_SERVICE_ROLE_KEY || "not-configured", {
    auth: { persistSession: false },
  });
}

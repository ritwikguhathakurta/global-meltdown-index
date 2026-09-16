import { createClient } from "./server";
import { createAdminClient } from "./admin";
import { isSupabaseConfigured } from "./config";
import type { User } from "@supabase/supabase-js";

export async function getCurrentUserAndRole(): Promise<{ user: User | null; isAdmin: boolean }> {
  if (!isSupabaseConfigured) return { user: null, isAdmin: false };
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { user: null, isAdmin: false };
    // The role lookup uses the service-role client, not the per-request
    // cookie-scoped one: the profiles table's own "admin" RLS policy
    // queries profiles from within itself to check admin status, which
    // Postgres cannot resolve (42P17 infinite recursion) — confirmed live
    // against the real database. This is a legitimate, narrow use of the
    // service-role client (an authorization check reading exactly one
    // already-authenticated user's own role), not a general RLS bypass.
    // The underlying policy still needs a proper SECURITY DEFINER fix in
    // Supabase directly (see supabase/migrations for the corrected policy).
    const admin = createAdminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    return { user, isAdmin: profile?.role === "admin" };
  } catch (e) {
    console.error((e as Error).message);
    return { user: null, isAdmin: false };
  }
}

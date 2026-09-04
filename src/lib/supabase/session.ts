import { createClient } from "./server";
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
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    return { user, isAdmin: profile?.role === "admin" };
  } catch (e) {
    console.error((e as Error).message);
    return { user: null, isAdmin: false };
  }
}

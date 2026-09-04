export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Harmless placeholders so the Supabase client can construct (and fail at the
// network layer, which callers already handle) instead of throwing at
// construction time when env vars are simply not set yet — lets the app run
// locally in a "backend not configured" state rather than 500ing on every route.
export const SUPABASE_URL_FALLBACK = process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY_FALLBACK = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "not-configured";

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, SUPABASE_URL_FALLBACK, SUPABASE_ANON_KEY_FALLBACK } from "./config";
import { createAdminClient } from "./admin";

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({ request });

  // No backend configured yet (local preview before Supabase is set up) — let
  // every route render its own "not configured" state instead of redirecting
  // in circles trying to check auth against a project that doesn't exist.
  if (!isSupabaseConfigured) return response;

  let mutableResponse = response;
  const supabase = createServerClient(SUPABASE_URL_FALLBACK, SUPABASE_ANON_KEY_FALLBACK, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        mutableResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => mutableResponse.cookies.set(name, value, options));
      },
    },
  });

  const pathname = request.nextUrl.pathname;
  const isPublic =
    pathname === "/" ||
    pathname === "/about" ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/opengraph-image" ||
    pathname === "/llms.txt" ||
    pathname === "/icon";
  const isProtected = !isPublic;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (pathname.startsWith("/admin")) {
      if (!user) {
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("next", pathname);
        return NextResponse.redirect(url);
      }
      // Service-role client, not the per-request cookie-scoped one — the
      // profiles table's own "admin" RLS policy recursively queries
      // profiles from within itself (42P17 infinite recursion, confirmed
      // live), so the user-scoped client can never successfully read this.
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
      if (profile?.role !== "admin") {
        const url = request.nextUrl.clone();
        url.pathname = "/dashboard";
        return NextResponse.redirect(url);
      }
    }

    if (isProtected && !user) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  } catch {
    // Supabase project unreachable (wrong/stale credentials) — fail closed on
    // protected routes rather than 500ing the whole site.
    if (isProtected) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }
  }

  return mutableResponse;
}

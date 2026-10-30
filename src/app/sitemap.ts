import type { MetadataRoute } from "next";

const SITE_URL = "https://globalmeltdownindex.net";

/**
 * `lastModified` is when the homepage's own public copy last changed, not
 * `new Date()` — Search Console compares lastmod against what it finds on a
 * recrawl, and a value that moves every deploy without the page's visible
 * content changing gets the field ignored outright. Bump this date when the
 * hero copy/sections on "/" actually change.
 *
 * Only "/" and "/about" are listed: they're the only routes the proxy
 * allowlist (src/lib/supabase/middleware.ts) lets a signed-out visitor — or
 * a crawler — reach without being redirected to /login.
 */
const LAST_MODIFIED = new Date("2026-10-29");
const ABOUT_LAST_MODIFIED = new Date("2026-10-30");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, lastModified: LAST_MODIFIED, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/about`, lastModified: ABOUT_LAST_MODIFIED, changeFrequency: "monthly", priority: 0.5 },
  ];
}

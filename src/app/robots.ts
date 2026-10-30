import type { MetadataRoute } from "next";

const SITE_URL = "https://globalmeltdownindex.net";

/**
 * Only "/" and "/about" are public, signed-out-reachable routes (see
 * src/lib/supabase/middleware.ts's isPublic allowlist) — everything under
 * /dashboard, /admin, etc. redirects an unauthenticated visitor (including a
 * crawler) straight to /login, so disallowing it here just saves Googlebot a
 * wasted fetch rather than hiding anything a plain Disallow could leak.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/$", "/about", "/opengraph-image", "/icon", "/llms.txt"],
      disallow: "/",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}

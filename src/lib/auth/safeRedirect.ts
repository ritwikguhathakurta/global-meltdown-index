/**
 * Post-login redirect targets come from a user-controllable `next` parameter.
 * Only same-site absolute paths are allowed: "//evil.com" and a leading
 * slash-backslash are treated as protocol-relative URLs by browsers, and
 * `${origin}${next}` with next="@evil.com" resolves to evil.com — so anything
 * that isn't a plain "/path" falls back to the default.
 */
export function safeNextPath(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/" + String.fromCharCode(92))) return fallback;
  for (const ch of next) {
    if (ch.charCodeAt(0) < 32) return fallback;
  }
  return next;
}

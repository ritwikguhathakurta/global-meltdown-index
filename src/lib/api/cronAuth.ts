import { timingSafeEqual } from "crypto";

/**
 * Shared bearer-token check for the /api/cron/* routes. Fails CLOSED: if
 * CRON_SECRET isn't configured, nobody is authorized — the previous inline
 * `if (secret && auth !== ...)` check let every caller through when the env
 * var was unset, exposing the service-role ingestion pipeline. The comparison
 * is constant-time.
 */
export function isAuthorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || !auth) return false;
  const given = Buffer.from(auth);
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

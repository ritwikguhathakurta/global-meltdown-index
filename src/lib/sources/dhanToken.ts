import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchRetry } from "./fetchRetry";

/**
 * Keeps the DhanHQ access token alive without a human. Dhan tokens last 24h; GET /v2/RenewToken
 * (with a still-valid token) returns a new 24h token and retires the old one — so the new one
 * MUST be persisted immediately. It lives in the single-row `dhan_token` table (migration 0054,
 * service-role only), because a serverless function can't rewrite its own Vercel env var.
 *
 * Token choice each run: the newer (by JWT `iat`) of the stored token and DHAN_ACCESS_TOKEN — so
 * pasting a fresh token into Vercel env takes over from a dead stored one. Then it renews and
 * stores the result. If the renewal call fails, the pre-renewal token is still returned so the
 * quote call can try it (it may have hours left).
 *
 * NOT VERIFIED END-TO-END against a live renewal at the time of writing (a renewal retires the
 * token, so it can't be tested harmlessly). The renewal response shape is read defensively; if no
 * token can be found in it, nothing is stored and the error names the keys the response had.
 */
const RENEW_URL = "https://api.dhan.co/v2/RenewToken";

function jwtIat(token: string): number {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8")) as { iat?: number };
    return payload.iat ?? 0;
  } catch {
    return 0;
  }
}

export async function getDhanAccessToken(db: SupabaseClient, clientId: string, envToken: string): Promise<{ token: string; note: string }> {
  const { data: row, error: readError } = await db.from("dhan_token").select("access_token").eq("id", 1).maybeSingle();
  if (readError) throw new Error(`dhan_token read failed (is migration 0054 applied?): ${readError.message}`);
  const stored = row?.access_token as string | undefined;
  const current = stored && jwtIat(stored) >= jwtIat(envToken) ? stored : envToken;

  let renewNote = "";
  try {
    const res = await fetchRetry(RENEW_URL, { headers: { "access-token": current, dhanClientId: clientId }, next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as Record<string, unknown>;
    const fresh = [body.accessToken, body.access_token, body.token].find((v): v is string => typeof v === "string" && v.split(".").length === 3);
    if (!fresh) throw new Error(`no token in renewal response (keys: ${Object.keys(body).join(",") || "none"})`);
    const now = new Date().toISOString();
    const { error: writeError } = await db.from("dhan_token").upsert({ id: 1, access_token: fresh, issued_at: now, updated_at: now });
    if (writeError) throw new Error(`renewed token could not be stored: ${writeError.message}`);
    return { token: fresh, note: "renewed" };
  } catch (e) {
    renewNote = `renewal failed: ${(e as Error).message}`;
  }
  if (current === envToken && !stored) {
    // First run and renewal failed: keep the env token usable on its own.
    await db.from("dhan_token").upsert({ id: 1, access_token: envToken, updated_at: new Date().toISOString() });
  }
  return { token: current, note: renewNote };
}

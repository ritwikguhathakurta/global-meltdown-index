import type { SupabaseClient } from "@supabase/supabase-js";
import { CENTRAL_BANK_FSR_REGISTRY, type CentralBankFsrEntry } from "../data/centralBankFsrRegistry";

/**
 * Automated freshness check for the Central Bank FSR Verification registry
 * (centralBankFsrRegistry.ts) — run on every pipeline cycle so a stale entry
 * gets flagged instead of silently sitting out of date until someone happens
 * to click through and notice. This does NOT rewrite the registry's
 * publishedDate/stance fields; it only reports whether the institution's own
 * page still shows what this app has on file, into central_bank_fsr_checks
 * (migration 0019). A flagged row still needs a human to read the new
 * edition and update centralBankFsrRegistry.ts — reading and classifying a
 * report's stance is a judgment call this app does not automate.
 */

export type FsrCheckStatus = "current" | "needs_review" | "check_failed";

export type FsrCheckResult = {
  key: string;
  status: FsrCheckStatus;
  note: string;
};

function normalizeHtml(html: string): string {
  let text = html.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&agrave;/gi, "a")
    .replace(/&egrave;/gi, "e")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)));
  return text.replace(/\s+/g, " ").trim();
}

async function checkHtmlEntry(entry: CentralBankFsrEntry): Promise<FsrCheckResult> {
  if (!entry.checkUrl || !entry.checkRegex || !entry.checkExpected) {
    return { key: entry.key, status: "check_failed", note: "Entry missing checkUrl/checkRegex/checkExpected" };
  }
  let html: string;
  try {
    const res = await fetch(entry.checkUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return { key: entry.key, status: "check_failed", note: `HTTP ${res.status} fetching ${entry.checkUrl}` };
    html = await res.text();
  } catch (e) {
    return { key: entry.key, status: "check_failed", note: `Fetch error: ${(e as Error).message}` };
  }

  const text = normalizeHtml(html);
  const regex = new RegExp(entry.checkRegex);
  const match = text.match(regex);
  if (!match) {
    return {
      key: entry.key,
      status: "needs_review",
      note: `Expected pattern not found on ${entry.checkUrl} — page may have changed or a newer edition replaced the layout.`,
    };
  }
  const found = match[1];
  if (found !== entry.checkExpected) {
    return {
      key: entry.key,
      status: "needs_review",
      note: `Listing now shows "${found}" — registry has "${entry.checkExpected}". A newer edition is likely out; verify and update centralBankFsrRegistry.ts.`,
    };
  }
  return { key: entry.key, status: "current", note: `Confirmed "${found}" still current as of this check.` };
}

async function checkRssEntry(db: SupabaseClient, entry: CentralBankFsrEntry): Promise<FsrCheckResult> {
  if (!entry.feedInstitution) {
    return { key: entry.key, status: "check_failed", note: "Entry missing feedInstitution" };
  }
  const { data, error } = await db
    .from("central_bank_events")
    .select("event_date, title, source_url")
    .eq("institution", entry.feedInstitution)
    .ilike("title", "%Financial Stability Report%")
    .gt("event_date", entry.publishedDate)
    .order("event_date", { ascending: false })
    .limit(1);
  if (error) return { key: entry.key, status: "check_failed", note: `central_bank_events query error: ${error.message}` };
  if (data && data.length > 0) {
    const row = data[0] as { event_date: string; title: string; source_url: string };
    return {
      key: entry.key,
      status: "needs_review",
      note: `central_bank_events shows a newer item (${row.event_date}): "${row.title}" — ${row.source_url}. Verify and update centralBankFsrRegistry.ts.`,
    };
  }
  return {
    key: entry.key,
    status: "current",
    note: `No newer "Financial Stability Report"-titled item found in central_bank_events for ${entry.feedInstitution} since ${entry.publishedDate}.`,
  };
}

export async function runCentralBankFsrChecks(db: SupabaseClient): Promise<FsrCheckResult[]> {
  return Promise.all(
    CENTRAL_BANK_FSR_REGISTRY.map((entry) => (entry.checkMethod === "rss" ? checkRssEntry(db, entry) : checkHtmlEntry(entry)))
  );
}

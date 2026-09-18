import { PDFParse } from "pdf-parse";

/**
 * Extracts the actual new policy rate from a Bank of Japan "Change in the
 * Guideline for Money Market Operations" decision PDF — the one piece of a
 * BOJ hike/cut that this app's other BOJ data genuinely cannot show same
 * day. `rate.japan_call_rate` (govBondYields.ts) is the REALIZED
 * uncollateralized overnight call rate, a market average BOJ's own
 * Time-Series API only publishes once trading has actually settled at the
 * new level — normally a few business days behind the announcement itself,
 * even though the announcement is already public. There is no free
 * structured-data field anywhere that carries "the new target is X%" the
 * moment it's announced; it only exists as English prose inside BOJ's own
 * PDF, linked from the headline already tracked in centralBankRss.ts /
 * central_bank_events.
 *
 * Parsing that PDF is fundamentally different from the "narrative summary"
 * this app has elsewhere refused to fabricate (vote counts, dissents,
 * economist commentary quoted from unverified text) — this is a live,
 * regex-verified extraction from BOJ's own primary document, in the same
 * spirit as the RBI HTML press-release parser (rbiLiquidity.ts) or the
 * World Bank Pink Sheet Excel parser (worldBankCommodities.ts): a specific,
 * known, official document format, not a guess. Verified live against a
 * real September 2026 release before shipping (see the git history for
 * this file) — pdf-parse (pure JS, no native binary, safe for Vercel's
 * serverless runtime) correctly extracted the target rate, vote count, and
 * effective date from BOJ's actual PDF.
 *
 * BOJ-specific and deliberately not generalized to other banks: this exact
 * "[Note] The Bank will encourage the uncollateralized overnight call rate
 * to remain at around X percent" phrasing is BOJ's own standing template,
 * confirmed only for BOJ. If BOJ ever changes its release wording (e.g.
 * returning to a target RANGE instead of a point target, as some other
 * central banks use), the regex below will simply fail to match and this
 * returns null — never a wrong number.
 */

export type BojAnnouncementDetail = {
  targetRatePercent: number | null;
  voteFor: number | null;
  voteAgainst: number | null;
  effectiveDate: string | null;
  sourceUrl: string;
};

export async function fetchBojAnnouncementDetail(pdfUrl: string): Promise<BojAnnouncementDetail | null> {
  try {
    const res = await fetch(pdfUrl, { headers: { "User-Agent": "GlobalMeltdownIndex-ingest/1.0" } });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());

    const parser = new PDFParse({ data: buf });
    const result = await parser.getText();
    await parser.destroy();
    const text = result.text;

    const rateMatch = text.match(/remain at around ([\d.]+)\s*percent/i);
    const voteMatch = text.match(/by a (\d+)-(\d+) majority vote/i);
    const effectiveMatch = text.match(/will be effective from ([A-Za-z]+ \d{1,2},\s*\d{4})/i);

    if (!rateMatch && !voteMatch) return null; // doesn't look like this template — don't guess

    return {
      targetRatePercent: rateMatch ? Number(rateMatch[1]) : null,
      voteFor: voteMatch ? Number(voteMatch[1]) : null,
      voteAgainst: voteMatch ? Number(voteMatch[2]) : null,
      effectiveDate: effectiveMatch ? effectiveMatch[1] : null,
      sourceUrl: pdfUrl,
    };
  } catch {
    return null;
  }
}

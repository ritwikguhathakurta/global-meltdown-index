import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { zScore, subtractSeriesByDate, type Point } from "../metrics/stats";
import { lookbackDaysFor } from "../metrics/lookback";

/**
 * Per-country credit-spread table for the Credit dashboard — G7 + China,
 * mirroring the same "one row per real-world unit, disclosed basis, z-score
 * regime" pattern as liquidityRegime.ts for the Liquidity tab. The Credit
 * engine (credit.ts) blends everything into one composite score; this
 * module exposes the same underlying real data broken out per country
 * instead, using the SAME regime labels and score bands (0-20/20-40/.../
 * 80-100) as that composite so a row here reads consistently with the
 * engine detail shown lower on the same page.
 *
 * What each row actually shows, since corporate credit isn't observable
 * per-country the way sovereign debt is:
 * - United States: US High-Yield OAS — a genuine US-specific signal.
 * - Germany / France / Italy: Euro-Area High-Yield OAS, the SAME value for
 *   all three — corporate bonds are priced as one EUR-currency market, not
 *   split by eurozone nation, so this is disclosed as shared rather than
 *   presented as if it were uniquely national. (Country-specific eurozone
 *   credit risk shows up on the sovereign side instead — see the Treasury
 *   tab's Italy-Germany/France-Germany spreads.)
 * - China: a genuine, dedicated AAA Corporate-Government spread from
 *   ChinaBond (same publisher, same tenor, same day for both legs) — a
 *   real per-country signal, not a regional proxy.
 * - United Kingdom / Canada / Japan: no free GBP, CAD or JPY-denominated
 *   corporate bond SPREAD index was found after checking FRED's entire ICE
 *   BofA Indices release (192 series, none non-USD/EUR) and the Bank of
 *   England's own database directly (publishes corporate bond issuance flow
 *   data, not a yield/spread series). Instead of leaving these UNAVAILABLE,
 *   each shows the BIS credit-to-GDP gap (bisCreditGap.ts) — a genuinely
 *   different, complementary kind of signal: a structural, quantity-side
 *   "is credit growing faster than its long-run trend relative to GDP"
 *   early-warning (the Basel III countercyclical-buffer indicator), not a
 *   market-priced spread. `basisKind` marks this distinction explicitly so
 *   the page can render it differently rather than implying it is the same
 *   kind of reading as the OAS-based rows. Their sovereign yield spread vs
 *   US Treasuries is separately tracked on the Treasury tab, referenced in
 *   the note but not duplicated here.
 */

export type CreditRegimeLabel = "COMPRESSED" | "NORMAL" | "WIDENING" | "STRESSED" | "DISLOCATED" | "INSUFFICIENT_DATA" | "UNAVAILABLE";
export type CreditBasisKind = "spread" | "credit_gap" | "unavailable";

function regimeFromZ(z: number | null): CreditRegimeLabel {
  if (z === null) return "INSUFFICIENT_DATA";
  const clamped = Math.max(-3, Math.min(3, z));
  const score = ((clamped + 3) / 6) * 100;
  if (score < 20) return "COMPRESSED";
  if (score < 40) return "NORMAL";
  if (score < 60) return "WIDENING";
  if (score < 80) return "STRESSED";
  return "DISLOCATED";
}

export type CountryCreditRow = {
  country: string;
  basisLabel: string;
  basisValue: number | null;
  basisUnit: string;
  basisAsOf: string | null;
  basisKind: CreditBasisKind;
  regime: CreditRegimeLabel;
  note: string | null;
};

async function loadSeries(db: SupabaseClient, key: string): Promise<Point[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - lookbackDaysFor("daily"));
  return fetchSeries(db, key, since.toISOString());
}

function latest(points: Point[]): Point | null {
  if (points.length === 0) return null;
  return points.reduce((a, b) => (a.t > b.t ? a : b));
}

function seriesRow(country: string, basisLabel: string, series: Point[], basisUnit: string, basisKind: CreditBasisKind, note: string | null = null): CountryCreditRow {
  const regime = regimeFromZ(zScore(series, 252));
  const last = latest(series);
  return {
    country,
    basisLabel,
    basisValue: last?.v ?? null,
    basisUnit,
    basisAsOf: last?.t ?? null,
    basisKind,
    regime,
    note,
  };
}

export async function getCountryCreditTable(db: SupabaseClient): Promise<CountryCreditRow[]> {
  const [hy, euroHy, chinaCorpAaa, chinaGov, ukGap, canadaGap, japanGap] = await Promise.all([
    loadSeries(db, "credit.hy_oas"),
    loadSeries(db, "credit.euro_hy_oas"),
    loadSeries(db, "credit.china_corp_aaa_10y"),
    loadSeries(db, "yield.china_10y"),
    loadSeries(db, "credit.uk_credit_gap"),
    loadSeries(db, "credit.canada_credit_gap"),
    loadSeries(db, "credit.japan_credit_gap"),
  ]);

  const chinaSpread = subtractSeriesByDate(chinaCorpAaa, chinaGov).map((p) => ({ t: p.t, v: p.v * 100 }));

  return [
    seriesRow("United States", "US High-Yield OAS", hy, "%", "spread"),
    seriesRow("Germany", "Euro-Area High-Yield OAS (shared EUR corporate market)", euroHy, "%", "spread", "Corporate bonds are priced as one EUR-currency market, not per eurozone nation — see the Treasury tab for Germany's own sovereign (Bund) yield."),
    seriesRow("France", "Euro-Area High-Yield OAS (shared EUR corporate market)", euroHy, "%", "spread", "Same shared EUR series as Germany/Italy — see the Treasury tab for France's own OAT-Bund sovereign spread."),
    seriesRow("Italy", "Euro-Area High-Yield OAS (shared EUR corporate market)", euroHy, "%", "spread", "Same shared EUR series as Germany/France — see the Treasury tab for Italy's own BTP-Bund sovereign spread, the classic eurozone fragmentation gauge."),
    seriesRow("United Kingdom", "Credit-to-GDP Gap (BIS)", ukGap, "pp of GDP", "credit_gap", "Not a spread — no free GBP corporate OAS index was found. This is the BIS/Basel III credit-boom gap instead: positive means credit has grown faster than its long-run trend relative to GDP. See the Treasury tab for the Gilt-UST sovereign spread, a different (sovereign) signal."),
    seriesRow("Canada", "Credit-to-GDP Gap (BIS)", canadaGap, "pp of GDP", "credit_gap", "Not a spread — no free CAD corporate OAS index was found. This is the BIS/Basel III credit-boom gap instead. See the Treasury tab for the GoC-UST sovereign spread."),
    seriesRow("Japan", "Credit-to-GDP Gap (BIS)", japanGap, "pp of GDP", "credit_gap", "Not a spread — no free JPY corporate OAS index was found. This is the BIS/Basel III credit-boom gap instead — currently positive and rising, unlike the other five G7 economies tracked here. See the Treasury tab for the JGB-UST sovereign spread (monthly OECD proxy)."),
    seriesRow("China", "AAA Corporate − Government Spread (10Y, ChinaBond)", chinaSpread, "bps", "spread", "Dedicated China signal, not a regional proxy — both legs from the same ChinaBond source, same tenor, same day."),
  ];
}

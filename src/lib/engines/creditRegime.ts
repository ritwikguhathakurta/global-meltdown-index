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
 * - United Kingdom / Canada / Japan: UNAVAILABLE. No free GBP, CAD or
 *   JPY-denominated corporate bond spread index was found after checking
 *   FRED's entire ICE BofA Indices release (192 series, none non-USD/EUR)
 *   and the Bank of England's own database directly (publishes corporate
 *   bond issuance flow data, not a yield/spread series). Their sovereign
 *   yield spread vs US Treasuries is tracked instead on the Treasury tab —
 *   a related but different (sovereign, not corporate) signal, so it is
 *   referenced here, not duplicated as if it were the same thing.
 */

export type CreditRegimeLabel = "COMPRESSED" | "NORMAL" | "WIDENING" | "STRESSED" | "DISLOCATED" | "INSUFFICIENT_DATA" | "UNAVAILABLE";

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

function seriesRow(country: string, basisLabel: string, series: Point[], basisUnit: string, note: string | null = null): CountryCreditRow {
  const regime = regimeFromZ(zScore(series, 252));
  const last = latest(series);
  return {
    country,
    basisLabel,
    basisValue: last?.v ?? null,
    basisUnit,
    basisAsOf: last?.t ?? null,
    regime,
    note,
  };
}

function unavailableRow(country: string, note: string): CountryCreditRow {
  return { country, basisLabel: "No free corporate spread source found", basisValue: null, basisUnit: "", basisAsOf: null, regime: "UNAVAILABLE", note };
}

export async function getCountryCreditTable(db: SupabaseClient): Promise<CountryCreditRow[]> {
  const [hy, euroHy, chinaCorpAaa, chinaGov] = await Promise.all([
    loadSeries(db, "credit.hy_oas"),
    loadSeries(db, "credit.euro_hy_oas"),
    loadSeries(db, "credit.china_corp_aaa_10y"),
    loadSeries(db, "yield.china_10y"),
  ]);

  const chinaSpread = subtractSeriesByDate(chinaCorpAaa, chinaGov).map((p) => ({ t: p.t, v: p.v * 100 }));

  return [
    seriesRow("United States", "US High-Yield OAS", hy, "%"),
    seriesRow("Germany", "Euro-Area High-Yield OAS (shared EUR corporate market)", euroHy, "%", "Corporate bonds are priced as one EUR-currency market, not per eurozone nation — see the Treasury tab for Germany's own sovereign (Bund) yield."),
    seriesRow("France", "Euro-Area High-Yield OAS (shared EUR corporate market)", euroHy, "%", "Same shared EUR series as Germany/Italy — see the Treasury tab for France's own OAT-Bund sovereign spread."),
    seriesRow("Italy", "Euro-Area High-Yield OAS (shared EUR corporate market)", euroHy, "%", "Same shared EUR series as Germany/France — see the Treasury tab for Italy's own BTP-Bund sovereign spread, the classic eurozone fragmentation gauge."),
    unavailableRow("United Kingdom", "No free GBP-denominated corporate OAS index found — see the Treasury tab for the Gilt-UST sovereign spread (a related but not equivalent, sovereign not corporate, signal)."),
    unavailableRow("Canada", "No free CAD-denominated corporate OAS index found — see the Treasury tab for the GoC-UST sovereign spread."),
    unavailableRow("Japan", "No free JPY-denominated corporate OAS index found — see the Treasury tab for the JGB-UST sovereign spread (monthly OECD proxy)."),
    seriesRow("China", "AAA Corporate − Government Spread (10Y, ChinaBond)", chinaSpread, "bps", "Dedicated China signal, not a regional proxy — both legs from the same ChinaBond source, same tenor, same day."),
  ];
}

import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchLatestForKeys } from "../metrics/store";
import { CREDIT_DATA_REGISTRY, creditGapReading, type CreditGapReading } from "../data/creditDataRegistry";
import { getCountryCreditTable, type CountryCreditRow } from "./creditRegime";

/**
 * Joins the Credit Data Verification registry (creditDataRegistry.ts) with
 * the real, already-ingested BIS credit-to-GDP gap values in metric_series,
 * and cross-references creditRegime.ts's own per-country Credit tab score
 * where this app has one — the same "match it with our score" pattern the
 * user asked for on the Banking tab's Central Bank FSR table, applied here.
 *
 * Unlike the FSR table, there is no separate freshness-check step: the same
 * ingestBisCreditGaps pipeline stage that already feeds Banking/Property is
 * the update mechanism here too, so `asOf` below is simply whatever the
 * latest already-ingested point is — see creditDataRegistry.ts's file
 * comment for why that makes this genuinely simpler to keep current than
 * the FSR registry's HTML/RSS checks.
 */
export type CreditVerificationRow = {
  key: string;
  region: string;
  country: string;
  institution: string;
  seriesName: string;
  sourceUrl: string;
  status: "available" | "unavailable";
  unavailableReason: string | null;
  gapValue: number | null;
  gapAsOf: string | null;
  reading: CreditGapReading | null;
  supplementalSources: { label: string; url: string }[];
  ourCreditRow: CountryCreditRow | null;
};

export async function getCreditDataVerification(db: SupabaseClient): Promise<CreditVerificationRow[]> {
  const metricKeys = CREDIT_DATA_REGISTRY.filter((e) => e.metricKey).map((e) => e.metricKey as string);
  const [latest, ourCreditRows] = await Promise.all([fetchLatestForKeys(db, metricKeys), getCountryCreditTable(db)]);
  const ourCreditByCountry = new Map(ourCreditRows.map((r) => [r.country, r]));

  return CREDIT_DATA_REGISTRY.map((entry) => {
    const point = entry.metricKey ? latest.get(entry.metricKey) : undefined;
    const gapValue = point?.v ?? null;
    return {
      key: entry.key,
      region: entry.region,
      country: entry.country,
      institution: entry.institution,
      seriesName: entry.seriesName,
      sourceUrl: entry.sourceUrl,
      status: entry.status,
      unavailableReason: entry.unavailableReason ?? null,
      gapValue,
      gapAsOf: point?.t ?? null,
      reading: creditGapReading(gapValue),
      supplementalSources: entry.supplementalSources ?? [],
      ourCreditRow: ourCreditByCountry.get(entry.country) ?? null,
    };
  });
}

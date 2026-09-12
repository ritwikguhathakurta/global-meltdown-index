import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchSeries } from "../metrics/store";
import { latest } from "../metrics/stats";

/**
 * CFTC positioning for the oilseed complex — spec §69-70. Reuses the same
 * generic CFTC COT ingest already built for FX/VIX/S&P (cftcCot.ts) — just
 * four more market names, no new infrastructure. Sunflower has no
 * CFTC-reportable US contract (traded mainly on Euronext/MATIF) — genuinely
 * unavailable, not estimated.
 */

const MARKETS = [
  { prefix: "cot.soybeans", label: "Soybeans (CBOT)" },
  { prefix: "cot.soybean_oil", label: "Soybean Oil (CBOT)" },
  { prefix: "cot.soybean_meal", label: "Soybean Meal (CBOT)" },
  { prefix: "cot.canola", label: "Canola (ICE US)" },
];

export type OilseedPositioningRow = {
  label: string;
  netNonCommercial: number | null;
  netPctOpenInterest: number | null;
  asOf: string | null;
};

export async function getOilseedPositioning(db: SupabaseClient): Promise<OilseedPositioningRow[]> {
  const since = new Date();
  since.setUTCFullYear(since.getUTCFullYear() - 1);
  const sinceIso = since.toISOString();

  return Promise.all(
    MARKETS.map(async (m) => {
      const [net, netPct] = await Promise.all([
        fetchSeries(db, `${m.prefix}.noncomm_net`, sinceIso),
        fetchSeries(db, `${m.prefix}.noncomm_net_pct_oi`, sinceIso),
      ]);
      const lastNet = latest(net);
      const lastPct = latest(netPct);
      return {
        label: m.label,
        netNonCommercial: lastNet?.v ?? null,
        netPctOpenInterest: lastPct?.v ?? null,
        asOf: lastNet?.t ?? null,
      };
    })
  );
}

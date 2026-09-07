import { getLatestEngine, getIndiaSeasonalNotes } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function IndiaLiquidityPage() {
  const [rows, seasonalNotes] = await Promise.all([getLatestEngine("india_liquidity"), getIndiaSeasonalNotes()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">India Liquidity</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        RBI&apos;s own daily net systemic liquidity (LAF injection/absorption) and the Weighted Average
        Call Rate, plus USDINR as a cross-check — separate from India Market Regime, which is a
        bullish/bearish equity-direction read rather than a banking-system liquidity read.
      </p>

      {seasonalNotes.length > 0 && (
        <div className="gfew-panel mb-6 max-w-3xl p-4 text-sm text-text-dim">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text-dim">
            Seasonal Pattern: Pre-Diwali &amp; Fiscal Year-End (Mar 15-31)
          </span>
          <ul className="list-inside list-disc space-y-1">
            {seasonalNotes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}

      <EngineDetail title="India Liquidity" rows={rows} />
    </div>
  );
}

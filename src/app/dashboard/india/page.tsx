import { getLatestIndiaRegime } from "@/lib/api/engineData";
import { InlineDisclaimer } from "@/components/Disclaimer";

export default async function IndiaPage() {
  const rows = await getLatestIndiaRegime();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">India Market Regime</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        FII futures positioning, FII/DII cash flows, PMI new orders, bank credit growth and GST
        collections are in the target indicator set but have no free daily data source wired up yet —
        this read is currently a global-shock-sensitivity proxy (USDINR, US 10Y, DXY, VIX, USDJPY) rather
        than the full document spec.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        {rows.map((r) => (
          <div key={r.horizon} className="gfew-panel p-5">
            <span className="text-xs uppercase tracking-wide text-text-dim">{r.horizon} term</span>
            <div className="mt-1 text-xl font-semibold">{r.classification ?? "N/A"}</div>
            <div className="mt-1 text-sm text-text-dim">
              Score {r.score ?? "N/A"} · Confidence {Math.round((r.confidence ?? 0) * 100)}%
            </div>
            {Array.isArray(r.top_positive) && r.top_positive.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] uppercase text-text-dim">Top positive</span>
                <ul className="mt-1 list-inside list-disc text-xs text-text-dim">
                  {(r.top_positive as { label: string }[]).map((d, i) => (
                    <li key={i}>{d.label}</li>
                  ))}
                </ul>
              </div>
            )}
            {Array.isArray(r.top_negative) && r.top_negative.length > 0 && (
              <div className="mt-3">
                <span className="text-[11px] uppercase text-text-dim">Top negative</span>
                <ul className="mt-1 list-inside list-disc text-xs text-text-dim">
                  {(r.top_negative as { label: string }[]).map((d, i) => (
                    <li key={i}>{d.label}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="gfew-panel p-6 text-sm text-text-dim sm:col-span-3">
            No data yet — trigger a pipeline run from /admin.
          </div>
        )}
      </div>

      <div className="mt-6">
        <InlineDisclaimer text="Current macro/market assessment — not investment advice or a buy/sell recommendation" />
      </div>
    </div>
  );
}

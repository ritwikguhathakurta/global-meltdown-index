import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import { fetchLiveMarketQuote } from "@/lib/sources/liveMarketQuotes";

export default async function EquitiesPage() {
  const [rows, liveNikkei] = await Promise.all([getLatestEngine("equity_fragility"), fetchLiveMarketQuote("nikkei225")]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Equity Fragility</h1>

      {liveNikkei && (
        <div className="mb-6 flex flex-wrap items-baseline gap-3 rounded-lg border border-border p-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-text-dim">Nikkei 225 (Live)</span>
          <span className="gfew-mono text-xl font-bold text-text">{liveNikkei.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
          <span className="text-xs" style={{ color: (liveNikkei.changePct ?? 0) >= 0 ? "#34c085" : "#e05a4d" }}>
            {liveNikkei.changePct !== null ? `${liveNikkei.changePct >= 0 ? "+" : ""}${liveNikkei.changePct.toFixed(2)}%` : "—"} vs prior close
          </span>
          <span className="text-[10px] text-text-dim">
            fetched at generation time, not the batch series below &middot;{" "}
            {new Date(liveNikkei.fetchedAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", timeZoneName: "short" })}
          </span>
        </div>
      )}

      <EngineDetail title="Equity Fragility" rows={rows} />
    </div>
  );
}

import Link from "next/link";
import { getEuropeanGrid } from "@/lib/api/engineData";
import { FUEL_BUCKETS } from "@/lib/sources/entsoe";

const FUEL_COLORS: Record<string, string> = {
  fossil: "#8b96a8",
  nuclear: "#e0b93d",
  hydro: "#3fa9f5",
  wind: "#34c085",
  solar: "#e0793d",
  other_renewable: "#9d7fe0",
};

const FUEL_LABELS: Record<string, string> = {
  fossil: "Fossil",
  nuclear: "Nuclear",
  hydro: "Hydro",
  wind: "Wind",
  solar: "Solar",
  other_renewable: "Other Renewable",
};

function fmt(v: number | null, decimals = 0): string {
  if (v === null) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function pctColor(v: number | null): string {
  if (v === null) return "#8b96a8";
  return v >= 0 ? "#e05a4d" : "#34c085"; // rising price = red (worse), falling = green — opposite of a "returns" convention
}

function fmtPctChange(current: number | null, previous: number | null): string {
  if (current === null || previous === null || previous === 0) return "—";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function GenerationMixBar({ mix, total }: { mix: Partial<Record<string, number>>; total: number | null }) {
  if (!total || total <= 0) return <span className="text-xs text-text-dim">—</span>;
  return (
    <div>
      <div className="flex h-2.5 w-full overflow-hidden rounded bg-panel-raised">
        {FUEL_BUCKETS.map((bucket) => {
          const v = mix[bucket];
          if (!v) return null;
          return <div key={bucket} style={{ width: `${(v / total) * 100}%`, background: FUEL_COLORS[bucket] }} title={`${FUEL_LABELS[bucket]}: ${fmt(v)} MW`} />;
        })}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[9px] text-text-dim">
        {FUEL_BUCKETS.map((bucket) => {
          const v = mix[bucket];
          if (!v) return null;
          return (
            <span key={bucket}>
              <span style={{ color: FUEL_COLORS[bucket] }}>■</span> {FUEL_LABELS[bucket]} {((v / total) * 100).toFixed(0)}%
            </span>
          );
        })}
      </div>
    </div>
  );
}

function fmtGwh(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} GWh`;
}

export default async function EuropeanGridPage() {
  const grid = await getEuropeanGrid();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/energy" className="text-xs text-accent hover:underline">
          ← Energy
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">European Grid Monitor &amp; Trade Network</h1>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        Real day-ahead electricity prices, load, and generation mix for 11 European bidding zones, plus a genuine
        physical cross-border flow network — all from the ENTSO-E Transparency Platform (the official hub all
        European transmission system operators report to), the same real-data discipline as the US ISO Grid
        Monitor on the main Energy page, extended to Europe.
      </p>

      {!grid && <p className="text-sm text-text-dim">European grid data is not yet available.</p>}

      {grid && (
        <>
          <section className="mb-10">
            <h2 className="mb-2 text-lg font-semibold">Grid Monitor</h2>
            <p className="mb-3 text-sm text-text-dim">
              Day-ahead price is a real EUR/MWh day-ahead auction clearing price (not a US-style locational marginal
              price — the closest genuine European equivalent). Load and generation are real MW levels averaged
              over the latest reported day; generation mix buckets ENTSO-E&apos;s own per-fuel PsrType codes into
              six families.
            </p>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Country / Zone</th>
                    <th className="px-3 py-2 font-medium">Day-Ahead Price</th>
                    <th className="px-3 py-2 font-medium">Load</th>
                    <th className="px-3 py-2 font-medium">Generation Mix</th>
                  </tr>
                </thead>
                <tbody>
                  {grid.rows.map((r) => (
                    <tr key={r.slug} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">{r.label}</td>
                      <td className="px-3 py-2">
                        <div className="gfew-mono text-text">{r.dayAheadPrice === null ? "—" : `${fmt(r.dayAheadPrice, 1)} EUR/MWh`}</div>
                        <div className="gfew-mono text-xs font-semibold" style={{ color: pctColor(r.dayAheadPrice !== null && r.dayAheadPricePrevious !== null ? r.dayAheadPrice - r.dayAheadPricePrevious : null) }}>
                          {fmtPctChange(r.dayAheadPrice, r.dayAheadPricePrevious)}
                        </div>
                        <div className="text-[10px] text-text-dim">{r.dayAheadPriceAsOf ?? "—"}</div>
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {r.loadMw === null ? "—" : `${fmt(r.loadMw)} MW`}
                        <div className="text-[10px] text-text-dim">{r.loadMwAsOf ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2" style={{ minWidth: 220 }}>
                        <GenerationMixBar mix={r.generationMix} total={r.totalGenerationMw} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {grid.tradeFlows.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">Cross-Border Electricity Trade Network</h2>
              <p className="mb-3 text-sm text-text-dim">
                Real physical MW flow readings across 18 verified live interconnections (36 directional pairs),
                aggregated to a monthly GWh total for {grid.tradeFlows[0]?.month ?? "the latest reported month"}.
                Unlike the UN Comtrade-based Global Energy Trade Network elsewhere on the Energy page, this is a
                monthly snapshot, not an annual value — ENTSO-E itself caps a cross-border-flow query at a
                1-month window, confirmed live before this was built.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">From</th>
                      <th className="px-3 py-2 font-medium">To</th>
                      <th className="px-3 py-2 font-medium">Monthly Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grid.tradeFlows.map((f) => (
                      <tr key={`${f.fromSlug}-${f.toSlug}`} className="border-t border-border align-top">
                        <td className="px-3 py-2 text-text-dim">{f.fromLabel}</td>
                        <td className="px-3 py-2 text-text-dim">{f.toLabel}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold text-text">{fmtGwh(f.valueGwh)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: day-ahead prices, load, and generation-per-fuel
        for 11 European bidding zones (Germany-Luxembourg, France, Spain, Netherlands, Belgium, Poland, Austria,
        Portugal, Czech Republic, Switzerland, and Italy&apos;s North zone), all from ENTSO-E&apos;s own TSO-reported
        data, verified live before use; and real physical cross-border flow readings across 18 live-verified
        interconnections. Generation mix is a genuine average of the latest reported day&apos;s MW levels, bucketed
        into six real ENTSO-E fuel-type families (not estimated or modeled).
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: Great Britain — its EIC domain resolves but
        ENTSO-E returns no day-ahead price data for it post-Brexit, checked live rather than assumed; Nordic zones
        (Norway/Sweden/Denmark) and Italy&apos;s other zones — each splits into multiple sub-zones (NO1-5, SE1-4,
        IT-Centre/South/Sicily/Sardinia, etc.) that would need their own verified adjacency map, deferred rather
        than guessed at; a full annual cross-border trade total to match the UN Comtrade Energy Trade
        Network&apos;s style — ENTSO-E cross-border-flow queries are capped at 1 month per request, so an annual
        figure would need 12 sequential monthly calls per direction per border (432+ calls), deferred pending a
        dedicated slower background job rather than risking the daily pipeline&apos;s timeout budget.
      </section>
    </div>
  );
}

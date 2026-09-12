import { getCommodityHeatmap } from "@/lib/api/engineData";
import { COMMODITY_CATEGORIES } from "@/lib/commodities/taxonomy";
import type { CommodityDirectionLabel, CommodityRow } from "@/lib/engines/commodities";

const DIRECTION_COLORS: Record<CommodityDirectionLabel, string> = {
  "STRONG POSITIVE": "#34c085",
  POSITIVE: "#3fa9f5",
  FLAT: "#8b96a8",
  NEGATIVE: "#e0793d",
  "STRONG NEGATIVE": "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function DirectionPill({ direction }: { direction: CommodityDirectionLabel }) {
  const color = DIRECTION_COLORS[direction];
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: `${color}22`, color }}>
      {direction.replace(/_/g, " ")}
    </span>
  );
}

function fmtPrice(v: number | null, unit: string): string {
  if (v === null) return "—";
  const decimals = v >= 100 ? 1 : v >= 1 ? 2 : 4;
  return `${v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

function fmtPct(v: number | null): string {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`;
}

function pctColor(v: number | null): string {
  if (v === null) return "#8b96a8";
  return v >= 0 ? "#34c085" : "#e05a4d";
}

export default async function CommoditiesPage() {
  const heatmap = await getCommodityHeatmap();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Commodities</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        Real monthly commodity prices from the World Bank Pink Sheet (free, no key, since 1960) and the IMF
        Primary Commodity Price System (free, no key, via DBnomics) across ~56 commodities, with a
        price-momentum signal — Phase 1 of a much larger planned build. See the disclosure below for what this
        is (and isn&apos;t) measuring yet.
      </p>

      {!heatmap && <p className="text-sm text-text-dim">Commodity data is not yet available.</p>}

      {heatmap && (
        <>
          <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Bullish</div>
              <div className="gfew-mono text-xl font-semibold" style={{ color: "#34c085" }}>
                {heatmap.breadth.bullishPct}%
              </div>
            </div>
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Neutral</div>
              <div className="gfew-mono text-xl font-semibold text-text-dim">{heatmap.breadth.neutralPct}%</div>
            </div>
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Bearish</div>
              <div className="gfew-mono text-xl font-semibold" style={{ color: "#e05a4d" }}>
                {heatmap.breadth.bearishPct}%
              </div>
            </div>
            <div className="gfew-panel p-3">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-text-dim">Coverage</div>
              <div className="gfew-mono text-xl font-semibold">
                {heatmap.breadth.withData}/{heatmap.breadth.total}
              </div>
            </div>
          </section>

          {COMMODITY_CATEGORIES.map((category) => {
            const rows: CommodityRow[] = heatmap.rows.filter((r) => r.category === category);
            if (rows.length === 0) return null;
            return (
              <section key={category} className="mb-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">{category}</h2>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-panel-raised text-text-dim">
                      <tr>
                        <th className="px-3 py-2 font-medium">Commodity</th>
                        <th className="px-3 py-2 font-medium">Price</th>
                        <th className="px-3 py-2 font-medium">1M</th>
                        <th className="px-3 py-2 font-medium">3M</th>
                        <th className="px-3 py-2 font-medium">12M</th>
                        <th className="px-3 py-2 font-medium">36M</th>
                        <th className="px-3 py-2 font-medium">5Y %ile</th>
                        <th className="px-3 py-2 font-medium">Momentum</th>
                        <th className="px-3 py-2 font-medium">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.slug} className="border-t border-border align-top">
                          <td className="px-3 py-2 font-medium">{r.label}</td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{fmtPrice(r.price, r.unit)}</td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change1m) }}>
                            {fmtPct(r.change1m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change3m) }}>
                            {fmtPct(r.change3m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change12m) }}>
                            {fmtPct(r.change12m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change36m) }}>
                            {fmtPct(r.change36m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{r.pricePercentile5y ?? "—"}</td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{r.momentumScore ?? "—"}</td>
                          <td className="px-3 py-2">
                            <DirectionPill direction={r.direction} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          <section className="gfew-panel p-4 text-xs text-text-dim">
            <strong className="text-text">Phase 1 of a much larger planned build.</strong> This is real World Bank
            Pink Sheet price data (free, no key, monthly since 1960, ~50 commodities) plus IMF Primary Commodity
            Price System data for six critical minerals (Cobalt, Lithium, Manganese, Molybdenum, Vanadium
            Pentoxide, and a Rare Earth Elements basket) — free, no key, mirrored via DBnomics after IMF&apos;s own
            API endpoints for this dataset were checked live and found dead. Each commodity gets a genuine
            price-momentum signal: 1M/3M/6M/12M/36M returns are z-scored against that same commodity&apos;s own
            trailing return history, then blended per the spec&apos;s own horizon weights (10/20/25/30/15) and
            classified into STRONG POSITIVE..STRONG NEGATIVE buckets. This is deliberately <em>not</em> called a
            &ldquo;Commodity Direction Score&rdquo; because the full CDS spec weights price momentum at only 10%
            alongside demand (20%), supply (15%), inventory (15%) and balance (15%) — none of which are wired in
            yet. Checked and confirmed missing from both free sources: Graphite, Tungsten, and a distinct OPEC
            Reference Basket series (EIA v2 publishes Brent/WTI/Dubai only; opec.org&apos;s own basket page returns
            HTTP 403 to unauthenticated requests). Genuinely still to build, in rough priority order:
            production/consumption/inventory data (USDA PSD for agriculture, FAOSTAT, EIA for energy — several of
            these are already partially ingested elsewhere on this app and can be reused rather than re-fetched), a
            real supply-demand balance table, the full weighted Commodity Direction Score, a UN Comtrade-based
            commodity trade network, an India-specific production/consumption/import-dependency view, a Global
            Commodity Stress Index, an early-warning alert engine, scenario/backtesting tools, and
            fundamental-value/forecast models. None of this is faked in the meantime — categories and commodities
            without real data simply don&apos;t appear above.
          </section>
        </>
      )}
    </div>
  );
}

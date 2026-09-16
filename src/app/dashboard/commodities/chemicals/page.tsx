import Link from "next/link";
import { getChemicalsOverview, getChemicalFeedstockReferencePrices } from "@/lib/api/engineData";
import { CHEMICAL_CATEGORIES } from "@/lib/commodities/chemicalsTaxonomy";
import type { ChemicalRow } from "@/lib/engines/chemicals";
import { DirectionPill, fmt, fmtPct, pctColor } from "../_components";
import { TrendIndicator } from "@/components/TrendIndicator";

const FEEDSTOCKS = [
  { slug: "crude_oil", label: "Crude Oil (WTI, NYMEX front-month)" },
  { slug: "natural_gas", label: "Natural Gas (Henry Hub, NYMEX front-month)" },
];

export default async function ChemicalsPage() {
  const [overview, feedstockPrices] = await Promise.all([getChemicalsOverview(), getChemicalFeedstockReferencePrices()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities" className="text-xs text-accent hover:underline">
          ← Commodities
        </Link>
      </div>
      <div className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <h1 className="text-2xl font-semibold">Chemicals</h1>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard/commodities/chemicals/products" className="text-xs text-accent hover:underline">
            Chemical Products Master (CAS/HS reference database) →
          </Link>
          <Link href="/dashboard/commodities/chemicals/oleochemicals" className="text-xs text-accent hover:underline">
            Oleochemicals deep-dive (palm-linked fatty acids, surfactants, trade flows) →
          </Link>
        </div>
      </div>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        Phase 1 of a much larger planned Chemicals engine, scoped to what&apos;s genuinely free and live. There is no
        free global FINISHED-chemical spot-price source (ICIS/Platts/ChemAnalyst are paywalled) — every value in the
        category tables below is a <strong className="text-text">US Producer Price Index (1982=100)</strong> from
        FRED, a real government price series, but not a global $/unit spot price. Momentum and direction still
        reflect genuine supply-demand conditions; the index level itself doesn&apos;t. Upstream feedstocks are a
        different story — see the reference prices just below. See the disclosure at the bottom for what&apos;s real
        here and what genuinely isn&apos;t built.
      </p>

      {feedstockPrices.size > 0 && (
        <section className="mb-8">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">
            Upstream Feedstock Reference Prices
          </h2>
          <p className="mb-3 max-w-3xl text-xs text-text-dim">
            Real daily futures settlement prices (delayed, not real-time — Massive, a paid market-data API) for the
            two raw inputs virtually every organic chemical on this page ultimately derives from. These are
            feedstock prices, not a finished-chemical price — closing this page&apos;s own long-standing spot-price
            gap for the inputs, not for the outputs the FRED indices below already cover.
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {FEEDSTOCKS.map((f) => {
              const p = feedstockPrices.get(f.slug);
              if (!p) return null;
              return (
                <div key={f.slug} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{f.label}</div>
                  <div className="mb-1 flex flex-wrap items-baseline gap-3">
                    <span className="gfew-mono text-xl font-semibold text-text">
                      {p.value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.unit}
                    </span>
                    <TrendIndicator value={p.value} previous={p.previous} />
                  </div>
                  <div className="text-[10px] text-text-dim">as of {p.asOf.slice(0, 10)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {!overview && <p className="text-sm text-text-dim">Chemical data is not yet available.</p>}

      {overview && (
        <>
          {CHEMICAL_CATEGORIES.map((category) => {
            const rows: ChemicalRow[] = overview.rows.filter((r) => r.category === category);
            if (rows.length === 0) return null;
            return (
              <section key={category} className="mb-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">{category}</h2>
                <div className="overflow-x-auto rounded border border-border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-panel-raised text-text-dim">
                      <tr>
                        <th className="px-3 py-2 font-medium">Chemical</th>
                        <th className="px-3 py-2 font-medium">Index Value</th>
                        <th className="px-3 py-2 font-medium">1M</th>
                        <th className="px-3 py-2 font-medium">3M</th>
                        <th className="px-3 py-2 font-medium">12M</th>
                        <th className="px-3 py-2 font-medium">5Y %ile</th>
                        <th className="px-3 py-2 font-medium">Direction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.slug} className="border-t border-border align-top">
                          <td className="px-3 py-2 font-medium">
                            {r.label}
                            {r.asOf && <div className="text-[10px] text-text-dim">{r.asOf.slice(0, 7)}</div>}
                          </td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.indexValue, 1)}</td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change1m) }}>
                            {fmtPct(r.change1m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change3m) }}>
                            {fmtPct(r.change3m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: pctColor(r.change12m) }}>
                            {fmtPct(r.change12m)}
                          </td>
                          <td className="gfew-mono px-3 py-2 text-text-dim">{r.indexPercentile5y ?? "—"}</td>
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
        </>
      )}

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: US Producer Price Index series from FRED
        (free, no key beyond this app&apos;s own registered key, official BLS data via FRED) for Basic Organic
        Chemicals, Ethanol, Basic Inorganic Chemicals, Industrial Chemicals, Sodium Hydroxide, Sulfuric Acid, Plastic
        Resins, Thermoplastic Resins, Fertilizer Materials, Synthetic Ammonia/Urea, Phosphate Fertilizer Materials,
        Fatty Acids, and Surfactants — history back to as early as 1933 for the broadest series, verified live
        against FRED&apos;s own series metadata before use; the same horizon-weighted z-scored-momentum methodology
        as the main Commodities page (spec §32), applied to these index series; and a dedicated Oleochemicals
        module (linked above) connecting Fatty Acids/Surfactants to the existing Palm Oil/PKO price data and to real
        UN Comtrade trade flows for Malaysia and Indonesia; and, new this pass, real daily Crude Oil (WTI) and
        Natural Gas (Henry Hub) futures settlement prices via Massive (a paid, delayed-not-real-time market-data
        API) as upstream feedstock reference prices.
        <br />
        <br />
        <strong className="text-text">Checked and confirmed genuinely unavailable</strong>: a free global
        FINISHED-chemical spot-price source — ICIS, Platts, and ChemAnalyst were checked and are paywalled industry
        data, not free/live APIs (Massive fills this for the two upstream feedstocks above, not for any finished
        chemical — it has no PVC/ammonia/methanol contract, for example); a free source for most specific named
        chemicals in the spec&apos;s taxonomy (individual fatty acids
        like Lauric/Palmitic/Stearic, fatty alcohols, methyl esters, glycerine, PFAD specifically, polymers like
        PE/PP/PVC individually) — FRED&apos;s PPI only breaks chemicals out to the family level shown above, not
        individual named compounds, so those don&apos;t appear as separate rows rather than being approximated from
        a broader family index.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: company-level production/trade/shipment
        intelligence (needs commercial vendors like Panjiva/Volza/ImportGenius — paid data this app has no budget or
        license for, and fabricating company names or shipment records is explicitly against this project&apos;s
        rules); capacity/plant/outage tracking (needs a maintained plant database this app doesn&apos;t have a free
        live source for); a Chemical Supply Risk Index, Chemical Demand Index, Chemical Flow Leading Indicator, and
        Chemical Market Regime classification (these need the production/capacity/inventory/company data above,
        which isn&apos;t built); Monte Carlo simulation, machine learning (XGBoost/LightGBM/regime-switching), and
        Granger causality/VAR analysis (this app is TypeScript/Next.js/Supabase only — no Python runtime exists to
        run these, and standing one up is an infrastructure decision, not something to build silently inside a data
        page); daily/weekly automated reports, an alert engine, and an &ldquo;Ask Chemicals&rdquo; AI assistant
        (depend on the data layers above existing first); HS/CAS crosswalk tables, a full chemical_products database
        schema, and per-chemical dedicated pages for products with no real data (the spec itself says not to
        generate pages for products with no data — followed here literally: only the chemicals with a genuine FRED
        series get a row).
      </section>
    </div>
  );
}

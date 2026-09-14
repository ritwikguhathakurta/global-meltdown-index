import Link from "next/link";
import { getOleochemicals } from "@/lib/api/engineData";
import { fmtPct, pctColor } from "../../_components";

function fmtIndexOrPrice(value: number | null, unit: string): string {
  if (value === null) return "—";
  const decimals = unit.startsWith("index") ? 1 : 2;
  return `${value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

function fmtUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

export default async function OleochemicalsPage() {
  const oleo = await getOleochemicals();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities/chemicals" className="text-xs text-accent hover:underline">
          ← Chemicals
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">Oleochemicals</h1>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        The special-depth module the Chemicals engine spec calls for: Palm Oil/PKO feedstock context (reusing the
        existing Oilseeds engine&apos;s data, not a new source), a downstream chemical price proxy (Fatty Acids &amp;
        Surfactants US PPI — see disclosure below for why this is an index, not a spot price), and real UN Comtrade
        trade flows for Malaysia and Indonesia, the world&apos;s two dominant oleochemical exporters.
      </p>

      {!oleo && <p className="text-sm text-text-dim">Oleochemical data is not yet available.</p>}

      {oleo && (
        <>
          <section className="mb-10">
            <h2 className="mb-2 text-lg font-semibold">Feedstock → Downstream Price Context</h2>
            <p className="mb-3 text-sm text-text-dim">
              Shown side by side, not merged into a margin: Palm Oil/PKO are genuine $/mt feedstock prices, while
              Fatty Acids/Surfactants are a US producer price index — computing a &ldquo;conversion margin&rdquo;
              from these two different units would produce a number that looks real but isn&apos;t, so it isn&apos;t
              shown.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {oleo.priceContext.map((p) => (
                <div key={p.slug} className="gfew-panel p-4">
                  <div className="mb-1 text-xs uppercase tracking-wide text-text-dim">{p.label}</div>
                  <div className="mb-2 flex flex-wrap items-baseline gap-3">
                    <span className="gfew-mono text-xl font-semibold">{fmtIndexOrPrice(p.latestValue, p.unit)}</span>
                    <span className="text-xs text-text-dim">{p.asOf?.slice(0, 7) ?? "—"}</span>
                  </div>
                  <div className="text-xs text-text-dim">
                    <span className="uppercase tracking-wide">12M change </span>
                    <span className="gfew-mono font-semibold" style={{ color: pctColor(p.change12m) }}>
                      {fmtPct(p.change12m)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {oleo.tradeFlows.length > 0 && (
            <section className="mb-10">
              <h2 className="mb-2 text-lg font-semibold">
                Oleochemical Trade Flows ({oleo.tradeFlowsAsOfYear ?? "—"})
              </h2>
              <p className="mb-3 text-sm text-text-dim">
                Real bilateral export values from UN Comtrade, among Malaysia, Indonesia, and their eight largest
                trading partners for these products (China, India, US, Netherlands, Germany, Pakistan, Japan, South
                Korea) — the exact same connector pattern as the Energy Trade Network graph, extended to a country
                and HS-code universe that actually covers the two dominant oleochemical exporters. HS 3823 covers
                industrial monocarboxylic fatty acids, acid oils from refining, and industrial fatty alcohols — the
                actual trade classification for fatty acids/PFAD, not a single dedicated HS code.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Product (HS)</th>
                      <th className="px-3 py-2 font-medium">Exporter</th>
                      <th className="px-3 py-2 font-medium">Importer</th>
                      <th className="px-3 py-2 font-medium">Export Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oleo.tradeFlows.slice(0, 30).map((f, i) => (
                      <tr key={`${f.commoditySlug}-${f.reporter}-${f.partner}-${i}`} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">
                          {f.commodityLabel}
                          <div className="text-[10px] text-text-dim">HS {f.hsCode}</div>
                        </td>
                        <td className="px-3 py-2 text-text-dim">{f.reporter}</td>
                        <td className="px-3 py-2 text-text-dim">{f.partner}</td>
                        <td className="gfew-mono px-3 py-2 font-semibold text-text">{fmtUsd(f.valueUsd)}</td>
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
        <strong className="text-text">What&apos;s real here</strong>: Palm Oil and Palm Kernel Oil feedstock prices
        (World Bank Pink Sheet, already ingested for the Oilseeds engine, reused here directly); Fatty Acids and
        Surfactants US Producer Price Index series from FRED, verified live; real bilateral export trade values from
        UN Comtrade for Palm Oil (HS 1511), Palm Kernel/Coconut Oil (HS 1513), industrial Fatty Acids/Acid
        Oils/Fatty Alcohols (HS 3823), and Surfactants (HS 3402), among Malaysia, Indonesia, and eight major trading
        partners — Malaysia and Indonesia were verified live as working Comtrade reporters (they aren&apos;t in the
        16-country set the Energy Trade Network already uses, so a separate, smaller country universe was built for
        this module specifically).
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: PFAD, individual fatty acids (Lauric/Palmitic/
        Stearic/Oleic etc.), fatty alcohols, methyl esters, FAME, and glycerine as separate priced products — no free
        live source publishes per-compound prices for any of these; a genuine oleochemical conversion margin (Palm
        Oil/PKO in → Fatty Acid/PFAD out) — needs a fatty-acid price in $/mt, not a PPI index, so it isn&apos;t
        computed (see the note in the price-context section above); company-level oleochemical producer/trader
        intelligence (Wilmar, IOI, KLK, Musim Mas, etc.) — no free live source publishes production or shipment data
        at the company level, and this project doesn&apos;t fabricate company names or figures; biodiesel/FAME/
        glycerine feedback loop modeling (spec §61) — depends on the missing per-compound price data above.
      </section>
    </div>
  );
}

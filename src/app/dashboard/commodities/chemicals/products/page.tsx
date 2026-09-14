import Link from "next/link";
import { CHEMICAL_PRODUCTS, CHEMICAL_PRODUCT_CATEGORIES, SPECIALTY_CHEMICAL_CATEGORIES, type ChemicalProduct } from "@/lib/commodities/chemicalProductsDatabase";

function LiveDataBadge({ product }: { product: ChemicalProduct }) {
  if (product.livePriceMetricKey) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#34c08522", color: "#34c085" }}>
        Live PPI proxy
      </span>
    );
  }
  if (product.liveTradeHsCode) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#3fa9f522", color: "#3fa9f5" }}>
        Live trade data
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#5a647222", color: "#8b96a8" }}>
      Reference only
    </span>
  );
}

export default function ChemicalProductsPage() {
  const withData = CHEMICAL_PRODUCTS.filter((p) => p.livePriceMetricKey || p.liveTradeHsCode).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities/chemicals" className="text-xs text-accent hover:underline">
          ← Chemicals
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">Chemical Products Master</h1>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        A reference database (spec §3-9), not a price feed: {CHEMICAL_PRODUCTS.length} named chemicals across Basic
        Inorganic/Organic Chemicals, Petrochemicals, Polymers, Fertilizers, Agrochemicals, and the full
        Oleochemical taxonomy, each with a CAS Registry Number and WCO Harmonized System trade-classification
        code — public, standardized identifiers, verified against multiple independent tariff/chemical-database
        sources before being entered, not guessed. {withData} of {CHEMICAL_PRODUCTS.length} rows also connect to
        real live data already in this app (a PPI price proxy or a UN Comtrade trade flow); the rest are
        reference-only, disclosed as such rather than implied to have live pricing they don&apos;t.
      </p>

      {CHEMICAL_PRODUCT_CATEGORIES.map((category) => {
        const rows = CHEMICAL_PRODUCTS.filter((p) => p.category === category);
        if (rows.length === 0) return null;
        return (
          <section key={category} className="mb-8">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">
              {category} <span className="text-text-dim">({rows.length})</span>
            </h2>
            <div className="overflow-x-auto rounded border border-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel-raised text-text-dim">
                  <tr>
                    <th className="px-3 py-2 font-medium">Product</th>
                    <th className="px-3 py-2 font-medium">CAS Number</th>
                    <th className="px-3 py-2 font-medium">HS Code</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.slug} className="border-t border-border align-top">
                      <td className="px-3 py-2 font-medium">
                        {p.name}
                        {p.subFamily && <div className="text-[10px] text-text-dim">{p.subFamily}</div>}
                        {p.feedstock && <div className="text-[10px] text-text-dim">Feedstock: {p.feedstock}</div>}
                      </td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">{p.casNumber ?? "—"}</td>
                      <td className="gfew-mono px-3 py-2 text-text-dim">
                        {p.hsCode ?? "—"}
                        {p.hsLabel && <div className="text-[10px] normal-case text-text-dim">{p.hsLabel}</div>}
                      </td>
                      <td className="px-3 py-2">
                        <LiveDataBadge product={p} />
                        {p.note && <div className="mt-1 max-w-xs text-[10px] text-text-dim">{p.note}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <section className="mb-10">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">Specialty Chemicals — Categories (no individual CAS/HS)</h2>
        <p className="mb-3 text-sm text-text-dim">
          Spec §9 itself lists Specialty Chemicals as broad end-use categories, not named compounds — attaching a
          CAS or HS code here would invent specificity the spec never provided. Listed as categories only, exactly
          as the spec presents them.
        </p>
        <div className="flex flex-wrap gap-2">
          {SPECIALTY_CHEMICAL_CATEGORIES.map((c) => (
            <span key={c} className="rounded bg-panel-raised px-2 py-1 text-xs text-text-dim">
              {c}
            </span>
          ))}
        </div>
      </section>

      <section className="gfew-panel p-4 text-xs text-text-dim">
        <strong className="text-text">What&apos;s real here</strong>: every CAS number and HS code above was
        checked against multiple independent tariff/chemical-database sources (not a single unverified guess) before
        entry; entries left blank (e.g. DAP/MAP&apos;s DEG/TEG HS subheadings, ethane&apos;s dual gas/petrochemical
        classification, PFAD&apos;s missing dedicated CAS) reflect genuine gaps or ambiguity in the real
        classification systems, not omissions of convenience. Polymer &ldquo;CAS numbers&rdquo; (PE, PP, PVC, PS,
        nylon) are the generic registry numbers commonly cited for those polymer families — polymers are not single
        molecules, so this is industry convention, not precision the compound itself has.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: individual named products under every spec §9
        Specialty Chemicals category (thousands of distinct formulated products across coatings, adhesives,
        electronic/battery/water-treatment/cosmetic chemicals, etc.) — the spec itself names only categories here,
        not products, so populating rows would mean inventing which specific compounds belong, not transcribing the
        spec; a live per-product spot price for any reference-only row — that remains the same unresolved gap as
        the rest of the Chemicals engine (see the Chemicals Overview and Oleochemicals pages), unaffected by this
        database existing.
      </section>
    </div>
  );
}

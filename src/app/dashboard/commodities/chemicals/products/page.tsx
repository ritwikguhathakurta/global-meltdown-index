import Link from "next/link";
import { CHEMICAL_PRODUCTS, CHEMICAL_PRODUCT_CATEGORIES, SPECIALTY_CHEMICAL_CATEGORIES } from "@/lib/commodities/chemicalProductsDatabase";
import { CHEMICAL_ENRICHMENT_BY_CAS } from "@/lib/commodities/chemicalProductsEnrichment";
import { getChemicalProductPrices, type ChemicalProductPrice } from "@/lib/api/engineData";
import { TrendIndicator } from "@/components/TrendIndicator";

export const dynamic = "force-dynamic";

function LiveDataBadge({ price }: { price?: ChemicalProductPrice }) {
  if (price?.basis === "ppi") {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#34c08522", color: "#34c085" }}>
        Live PPI proxy
      </span>
    );
  }
  if (price) {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#3fa9f522", color: "#3fa9f5" }}>
        Live avg price (Comtrade)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide" style={{ background: "#5a647222", color: "#8b96a8" }}>
      Reference only
    </span>
  );
}

function fmtMonth(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function PriceCell({ price }: { price?: ChemicalProductPrice }) {
  if (!price) return <span className="text-text-dim">—</span>;
  const caption =
    price.basis === "ppi"
      ? `index 1982=100 · ${fmtMonth(price.asOf)}`
      : `avg ${price.basis === "export_unit_value" ? "export" : "import"} unit value, USD/MT · ${fmtMonth(price.asOf)}`;
  return (
    <>
      <div>
        {price.value.toLocaleString(undefined, { maximumFractionDigits: price.basis === "ppi" ? 1 : 0 })}
        <TrendIndicator value={price.value} previous={price.previous} />
      </div>
      <div className="text-[10px] normal-case text-text-dim">{caption}</div>
    </>
  );
}

export default async function ChemicalProductsPage() {
  const withMolecularData = CHEMICAL_PRODUCTS.filter((p) => p.casNumber && CHEMICAL_ENRICHMENT_BY_CAS[p.casNumber]).length;
  const prices = await getChemicalProductPrices();
  const withPpi = [...prices.values()].filter((p) => p.basis === "ppi").length;
  const withUnitValue = prices.size - withPpi;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-2 flex items-center gap-3">
        <Link href="/dashboard/commodities/chemicals" className="text-xs text-accent hover:underline">
          ← Chemicals
        </Link>
      </div>
      <h1 className="mb-6 text-2xl font-semibold">Chemical Products Master</h1>
      <p className="mb-8 max-w-3xl text-sm text-text-dim">
        Primarily a reference database (spec §3-9): {CHEMICAL_PRODUCTS.length} named chemicals across Basic
        Inorganic/Organic Chemicals, Petrochemicals, Polymers, Fertilizers, Agrochemicals, and the full
        Oleochemical taxonomy, each with a CAS Registry Number and WCO Harmonized System trade-classification
        code — public, standardized identifiers, verified against multiple independent tariff/chemical-database
        sources before being entered, not guessed. {prices.size} of {CHEMICAL_PRODUCTS.length} rows show a real
        price below: {withPpi} from a FRED Producer Price Index proxy (&ldquo;Live PPI proxy&rdquo; — a US
        producer-price index, monthly, shown with its month-over-month move) and {withUnitValue} from a UN Comtrade
        average export/import unit value (&ldquo;Live avg price (Comtrade)&rdquo; — the United States&apos; own
        declared customs value ÷ net weight for that HS code, also monthly, shown with its month-over-month move;
        not a global benchmark price, since it reflects one country&apos;s own trade — and typically 1-2 months
        older than the PPI rows&apos; own latest month, since US customs trade data has a longer release lag than
        the PPI). The remaining rows are reference-only — no free price source was found for their exact HS
        code, disclosed as such rather than implied to have live pricing they don&apos;t.{" "}
        {withMolecularData}
        of {CHEMICAL_PRODUCTS.length} rows also show a real molecular formula and molecular weight from PubChem
        (NIH/NLM) — every polymer family and genuine mixture is deliberately left blank rather than assigned a
        single molecular weight it doesn&apos;t have (see the disclosure at the bottom).
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
                    <th className="px-3 py-2 font-medium">Formula (MW)</th>
                    <th className="px-3 py-2 font-medium">Price</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const enrichment = p.casNumber ? CHEMICAL_ENRICHMENT_BY_CAS[p.casNumber] : undefined;
                    return (
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
                        <td className="gfew-mono px-3 py-2 text-text-dim">
                          {enrichment ? (
                            <>
                              {enrichment.molecularFormula}
                              <div className="text-[10px] text-text-dim">{enrichment.molecularWeightGMol.toLocaleString(undefined, { maximumFractionDigits: 2 })} g/mol</div>
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">
                          <PriceCell price={prices.get(p.slug)} />
                        </td>
                        <td className="px-3 py-2">
                          <LiveDataBadge price={prices.get(p.slug)} />
                          {p.note && <div className="mt-1 max-w-xs text-[10px] text-text-dim">{p.note}</div>}
                        </td>
                      </tr>
                    );
                  })}
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
        <strong className="text-text">Molecular Formula/MW</strong>: sourced from PubChem PUG-REST (NIH/NLM — free,
        keyless, official), via each product&apos;s CAS number. PubChem&apos;s CAS cross-reference lookup returns
        multiple candidate compounds per CAS number, and a live check during this build found the first candidate is
        often wrong (styrene&apos;s CAS matched to glucose first, sodium hydroxide&apos;s to a cyclic carbonate,
        chlorine&apos;s to hydrochloric acid) — every value shown here instead passed a second check confirming the
        candidate compound&apos;s own synonym list actually contains the CAS number being looked up, before being
        accepted. Every Polymers-category entry, Naphtha, mixed Xylenes, and Sodium Laureth Sulfate show no
        formula/MW — none of their CAS numbers represent one discrete molecule (already disclosed in each row&apos;s
        own note), and none of their PubChem candidates passed that verification, correctly.
        <br />
        <br />
        <strong className="text-text">Price</strong>: PPI proxies are the same real FRED series used elsewhere in
        the Chemicals engine (see fred.ts). Unit-value prices are new here — one UN Comtrade call per distinct HS
        code (not per product, since e.g. every C6-C18 fatty acid shares HS 3823) against a single reference
        reporter, the United States, rather than every country: this app already establishes elsewhere (the Base
        Metals/Precious Metals/Critical Minerals/Fertilizers Country Balance Sheets) that a full country-by-country
        trade picture needs one call per country, which isn&apos;t affordable for ~45 additional HS codes on the same
        shared daily quota — a single reputable reporter&apos;s own declared unit value is a standard economist&apos;s
        proxy for a commodity&apos;s price when no dedicated spot-price feed is free, but it is still that one
        country&apos;s own price, not a volume-weighted global benchmark. It is monthly (US Census monthly trade
        data, live-verified before switching this from an earlier annual version), but always trails the PPI
        rows&apos; own latest month by roughly 4-8 weeks — US customs trade data has a longer publication lag than
        the PPI, confirmed live: at the time this was built, July was the newest month available anywhere for
        several test HS codes while August PPI data already existed. Each row always shows whichever month is
        genuinely newest, so it rolls forward automatically as the Census publishes each one. Some HS codes still
        show &ldquo;—&rdquo;: the United States genuinely reports neither export nor import weight-denominated
        trade for that code in the last 12 months (e.g. it reports trade value only, or the code sees negligible US
        trade volume) — left blank rather than guessed.
        <br />
        <br />
        <strong className="text-text">Not built</strong>, and why: individual named products under every spec §9
        Specialty Chemicals category (thousands of distinct formulated products across coatings, adhesives,
        electronic/battery/water-treatment/cosmetic chemicals, etc.) — the spec itself names only categories here,
        not products, so populating rows would mean inventing which specific compounds belong, not transcribing the
        spec.
      </section>
    </div>
  );
}

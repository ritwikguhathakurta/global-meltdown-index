import { getLatestEngine, getCountryCreditTable, getCreditDataVerificationTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { CreditRegimeLabel, CreditBasisKind } from "@/lib/engines/creditRegime";
import type { CreditVerificationRow } from "@/lib/engines/creditDataVerification";
import { FSR_REGION_ORDER } from "@/lib/data/centralBankFsrRegistry";

function readingColor(reading: string | null): string {
  if (reading === "expanding") return "#e0793d";
  if (reading === "contracting") return "#3fa9f5";
  if (reading === "neutral") return "#34c085";
  return "#5a6472";
}

function readingLabel(reading: string | null): string {
  if (reading === "expanding") return "Expanding (credit boom building)";
  if (reading === "contracting") return "Contracting";
  if (reading === "neutral") return "Neutral";
  return "—";
}

function regimeGapDelta(row: CreditVerificationRow): { label: string; color: string } | null {
  if (row.gapValue === null || !row.ourCreditRow || row.ourCreditRow.basisKind !== "spread") return null;
  const spreadStressed = row.ourCreditRow.regime === "STRESSED" || row.ourCreditRow.regime === "DISLOCATED";
  const gapStressed = row.reading === "expanding";
  if (spreadStressed === gapStressed) return { label: "Consistent", color: "#5a6472" };
  if (gapStressed && !spreadStressed) return { label: "Credit-gap reads more stress", color: "#e0793d" };
  return { label: "Spread reads more stress", color: "#3fa9f5" };
}

const REGIME_COLORS: Record<CreditRegimeLabel, string> = {
  COMPRESSED: "#34c085",
  NORMAL: "#3fa9f5",
  WIDENING: "#e0b93d",
  STRESSED: "#e0793d",
  DISLOCATED: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
  UNAVAILABLE: "#5a6472",
};

function RegimePill({ regime }: { regime: CreditRegimeLabel }) {
  const color = REGIME_COLORS[regime];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{ background: `${color}22`, color }}
    >
      {regime.replace("_", " ")}
    </span>
  );
}

const BASIS_KIND_LABEL: Record<CreditBasisKind, string> = {
  spread: "Market Spread",
  credit_gap: "Credit-to-GDP Gap",
  unavailable: "Unavailable",
};

function BasisKindTag({ kind }: { kind: CreditBasisKind }) {
  return (
    <span className="ml-2 inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-dim">
      {BASIS_KIND_LABEL[kind]}
    </span>
  );
}

function fmt(v: number | null, unit: string): string {
  if (v === null) return "—";
  const rounded = Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v === Math.trunc(v) ? 0 : 2);
  return `${rounded}${unit ? " " + unit : ""}`;
}

export default async function CreditPage() {
  const [rows, countryTable, verificationRows] = await Promise.all([
    getLatestEngine("credit"),
    getCountryCreditTable(),
    getCreditDataVerificationTable(),
  ]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Credit Markets</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        US HY/IG, EM and Euro-area high-yield OAS, a dedicated China AAA corporate-government
        spread, plus a BIS credit-to-GDP gap for UK/Canada/Japan where no free corporate spread
        index exists — see the methodology page for the full sourcing detail.
      </p>

      <section className="gfew-panel mb-8 p-4" id="central-bank-credit-data-verification">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text-dim">
            Central Bank Credit Data Verification
          </h3>
          <a href="/dashboard/methodology#central-bank-credit-data-verification" className="text-xs text-accent hover:underline">
            Methodology →
          </a>
        </div>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          The same 34-country universe as the Banking tab&apos;s Central Bank FSR Verification table.
          Every reading is the BIS (Bank for International Settlements) Credit-to-GDP Gap — the
          official Basel III countercyclical-buffer indicator — genuinely ingested from BIS&apos;s
          free SDMX API, not a curated narrative. There is no separate freshness check to run: the
          same pipeline stage that already feeds this data to the Banking and Property engines keeps
          this table current automatically. Six countries (Philippines, Romania, Peru, UAE, Kenya,
          Egypt) are marked unavailable — checked directly against BIS&apos;s live API, which simply
          does not cover them; no weaker substitute was used. &ldquo;Δ vs Our Credit Score&rdquo;
          cross-checks this quantity-side reading against the Credit tab&apos;s own market-spread-based
          score below, for the countries where this app has one.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Credit-to-GDP Gap</th>
                <th className="px-3 py-2 font-medium">As Of</th>
                <th className="px-3 py-2 font-medium">Reading</th>
                <th className="px-3 py-2 font-medium">Our Credit Score</th>
                <th className="px-3 py-2 font-medium">Δ vs Our Credit Score</th>
              </tr>
            </thead>
            <tbody>
              {FSR_REGION_ORDER.flatMap((region) => {
                const entries = verificationRows.filter((r) => r.region === region);
                if (entries.length === 0) return [];
                return [
                  <tr key={`region-${region}`} className="border-t border-border bg-panel-raised">
                    <td colSpan={7} className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-dim">
                      {region} ({entries.length})
                    </td>
                  </tr>,
                  ...entries.map((row) => {
                    const delta = regimeGapDelta(row);
                    return (
                      <tr key={row.key} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium">{row.country}</td>
                        <td className="px-3 py-2">
                          {row.status === "available" ? (
                            <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                              BIS Credit-to-GDP Gap
                            </a>
                          ) : (
                            <span className="text-text-dim" title={row.unavailableReason ?? undefined}>
                              Unavailable
                            </span>
                          )}
                          {row.supplementalSources.map((s) => (
                            <div key={s.url}>
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-accent hover:underline">
                                + {s.label}
                              </a>
                            </div>
                          ))}
                        </td>
                        <td className="gfew-mono px-3 py-2">
                          {row.gapValue !== null ? `${row.gapValue > 0 ? "+" : ""}${row.gapValue.toFixed(1)} pp` : "—"}
                        </td>
                        <td className="px-3 py-2 text-text-dim">{row.gapAsOf ?? "—"}</td>
                        <td className="px-3 py-2">
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium"
                            style={{ background: `${readingColor(row.reading)}22`, color: readingColor(row.reading) }}
                          >
                            {readingLabel(row.reading)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-text-dim">
                          {row.ourCreditRow ? (
                            <RegimePill regime={row.ourCreditRow.regime} />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">
                          {delta ? <span style={{ color: delta.color }}>{delta.label}</span> : <span className="text-text-dim">—</span>}
                        </td>
                      </tr>
                    );
                  }),
                ];
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Credit Spreads by Country (G7 + China)
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Corporate credit isn&apos;t observable per-country the way sovereign debt is: eurozone
          corporates (Germany, France, Italy) are priced as one EUR market, so those three rows
          share the same Euro-Area High-Yield OAS value, disclosed rather than presented as
          uniquely national. China gets its own dedicated AAA corporate-government spread from
          ChinaBond. UK, Canada and Japan have no free corporate spread index (checked FRED&apos;s
          entire ICE BofA Indices release and the Bank of England&apos;s own database directly), so
          those three instead show the <strong>BIS credit-to-GDP gap</strong> — tagged &ldquo;Credit-to-GDP
          Gap&rdquo; below to mark it as a genuinely different kind of signal: a structural,
          quantity-side credit-boom early-warning (Basel III&apos;s own countercyclical-buffer
          indicator), not a market-priced spread. A high reading there means credit has grown
          faster than its long-run trend relative to GDP, not that a spread has widened. Regime
          bands are the same 0-20/20-40/.../80-100 z-score scale as the composite engine below, but
          read a &ldquo;Credit-to-GDP Gap&rdquo; row&apos;s regime as boom/bust positioning, not
          spread stress. Each country&apos;s sovereign yield spread is tracked separately on the
          Treasury tab.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Basis</th>
                <th className="px-3 py-2 font-medium">Value</th>
                <th className="px-3 py-2 font-medium">As Of</th>
                <th className="px-3 py-2 font-medium">Regime</th>
              </tr>
            </thead>
            <tbody>
              {countryTable.map((r) => (
                <tr key={r.country} className="border-t border-border">
                  <td className="px-3 py-2">{r.country}</td>
                  <td className="px-3 py-2 text-text-dim" title={r.note ?? undefined}>
                    {r.basisLabel}
                    <BasisKindTag kind={r.basisKind} />
                  </td>
                  <td className="gfew-mono px-3 py-2">{fmt(r.basisValue, r.basisUnit)}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{r.basisAsOf ?? "—"}</td>
                  <td className="px-3 py-2">
                    <RegimePill regime={r.regime} />
                  </td>
                </tr>
              ))}
              {countryTable.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-dim">
                    No data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <EngineDetail title="Credit Markets" rows={rows} />
    </div>
  );
}

import { getLatestEngine, getCountryCreditTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { CreditRegimeLabel } from "@/lib/engines/creditRegime";

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

function fmt(v: number | null, unit: string): string {
  if (v === null) return "—";
  const rounded = Math.abs(v) >= 100 ? Math.round(v).toLocaleString() : v.toFixed(v === Math.trunc(v) ? 0 : 2);
  return `${rounded}${unit ? " " + unit : ""}`;
}

export default async function CreditPage() {
  const [rows, countryTable] = await Promise.all([getLatestEngine("credit"), getCountryCreditTable()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Credit Markets</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        US HY/IG, EM and Euro-area high-yield OAS, plus a dedicated China AAA corporate-government
        spread — see the methodology page for why UK, Canada and Japan have no free country-specific
        corporate spread source.
      </p>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Credit Spreads by Country (G7 + China)
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Corporate credit isn&apos;t observable per-country the way sovereign debt is: eurozone
          corporates (Germany, France, Italy) are priced as one EUR market, so those three rows
          share the same Euro-Area High-Yield OAS value, disclosed rather than presented as
          uniquely national. China gets its own dedicated AAA corporate-government spread from
          ChinaBond. UK, Canada and Japan are marked UNAVAILABLE — no free GBP, CAD or
          JPY-denominated corporate spread index was found (checked FRED&apos;s entire ICE BofA
          Indices release and the Bank of England&apos;s own database directly); their sovereign
          yield spread is tracked instead on the Treasury tab, a related but different signal.
          Regime bands are the same 0-20/20-40/.../80-100 z-score scale as the composite engine
          below.
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

import { getLatestEngine, getCountryEmDebtTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { EmDebtRegimeLabel } from "@/lib/engines/emDebtRegime";

const REGIME_COLORS: Record<EmDebtRegimeLabel, string> = {
  AMPLE_ACCESS: "#34c085",
  NORMAL: "#3fa9f5",
  TIGHTENING: "#e0b93d",
  FUNDING_STRESS: "#e0793d",
  SUDDEN_STOP: "#e05a4d",
  INSUFFICIENT_DATA: "#5a6472",
};

function RegimePill({ regime }: { regime: EmDebtRegimeLabel }) {
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
  return `${rounded} ${unit}`;
}

export default async function EmDebtPage() {
  const [rows, countryTable] = await Promise.all([getLatestEngine("emerging_market_debt"), getCountryEmDebtTable()]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Emerging-Market Debt</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        A broad EM corporate-bond OAS and dollar index, plus a per-country USD exchange-rate
        stress reading across the MSCI Emerging Markets constituents the ECB publishes a daily
        reference rate for — see the methodology page for the full sourcing detail.
      </p>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Currency Stress by Country (Prominent Emerging Markets)
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          No free per-country EM sovereign dollar-bond spread exists (JPMorgan&apos;s EMBI, the
          standard benchmark, is a paid proprietary index) — the USD exchange rate is used instead
          as the per-country stress proxy, since currency weakness is the actual transmission
          channel this engine tracks: it directly raises the local-currency cost of servicing
          dollar-denominated debt. Regime bands are the same 0-20/20-40/.../80-100 z-score scale
          as the composite engine below. Fourteen countries are covered — the MSCI Emerging
          Markets constituents the ECB itself publishes a daily reference rate for. Taiwan, Chile,
          Colombia, Peru, Saudi Arabia, the UAE, Qatar and Kuwait are prominent EM debt issuers too
          but have no free daily FX source found yet, so they are not included here.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">FX Pair</th>
                <th className="px-3 py-2 font-medium">Rate</th>
                <th className="px-3 py-2 font-medium">As Of</th>
                <th className="px-3 py-2 font-medium">Regime</th>
              </tr>
            </thead>
            <tbody>
              {countryTable.map((r) => (
                <tr key={r.country} className="border-t border-border">
                  <td className="px-3 py-2">{r.country}</td>
                  <td className="px-3 py-2 text-text-dim">{r.fxPair}</td>
                  <td className="gfew-mono px-3 py-2">{fmt(r.value, r.unit)}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{r.asOf ?? "—"}</td>
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

      <EngineDetail title="Emerging-Market Debt" rows={rows} />
    </div>
  );
}

import { getLatestEngine, getCountryEmDebtTable } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";
import type { EmDebtRegimeLabel, CountryEmDebtRow } from "@/lib/engines/emDebtRegime";

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
      {regime.replace(/_/g, " ")}
    </span>
  );
}

function scoreColor(score: number | null): string {
  if (score === null) return "#5a6472";
  if (score < 20) return "#34c085";
  if (score < 40) return "#3fa9f5";
  if (score < 60) return "#e0b93d";
  if (score < 80) return "#e0793d";
  return "#e05a4d";
}

function fmt(v: number | null, unit: string, decimals = 1): string {
  if (v === null) return "—";
  return `${v.toFixed(decimals)}${unit ? " " + unit : ""}`;
}

function fmtScore(v: number | null): string {
  return v === null ? "—" : String(v);
}

export default async function EmDebtPage() {
  const [rows, countryTable] = await Promise.all([getLatestEngine("emerging_market_debt"), getCountryEmDebtTable()]);

  const ranked = [...countryTable].sort((a, b) => (b.vulnerabilityScore ?? -1) - (a.vulnerabilityScore ?? -1));
  const topRisks = ranked.filter((r) => r.vulnerabilityScore !== null).slice(0, 5);
  const hiddenRisks = countryTable.filter((r) => r.latentRisk);
  const marketLed = countryTable.filter((r) => r.marketLedWarning);
  const stressedCount = countryTable.filter((r) => (r.vulnerabilityScore ?? 0) >= 60).length;

  function why(r: CountryEmDebtRow): string {
    const s = r.structuralScore ?? 0;
    const m = r.marketScore ?? 0;
    if (s > m + 10) return "structural fundamentals (debt, external funding, reserves) are the main driver";
    if (m > s + 10) return "market pricing (currency, sovereign CDS) is the main driver";
    return "both structural fundamentals and market pricing are elevated together";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Emerging-Market Debt</h1>
      <p className="mb-6 max-w-3xl text-sm text-text-dim">
        A structural sovereign-vulnerability score (World Bank debt, external funding, reserve and
        fiscal data) blended with market pricing (currency stress and sovereign CDS where quoted)
        and a contagion-breadth measure across 14 tracked emerging markets — replacing the earlier
        FX-only approach. See the methodology page for the full breakdown of what is and is not
        included, and why.
      </p>

      <section className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Where Risk Is Building
          </h3>
          {topRisks.length === 0 && <p className="text-sm text-text-dim">No data yet.</p>}
          <ol className="space-y-2">
            {topRisks.map((r, i) => (
              <li key={r.country} className="text-sm">
                <span className="gfew-mono mr-2 text-text-dim">{i + 1}.</span>
                <span className="font-medium">{r.country}</span>{" "}
                <span className="gfew-mono" style={{ color: scoreColor(r.vulnerabilityScore) }}>
                  {r.vulnerabilityScore}
                </span>
                <div className="ml-5 text-xs text-text-dim">{why(r)}</div>
              </li>
            ))}
          </ol>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Hidden Risk (structural building, market still calm)
          </h3>
          {hiddenRisks.length === 0 ? (
            <p className="text-sm text-text-dim">None currently — no country shows elevated structural vulnerability while market pricing stays calm.</p>
          ) : (
            <ul className="space-y-1">
              {hiddenRisks.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (structural {r.structuralScore}, market {r.marketScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">
            Market Already Warning (pricing ahead of fundamentals)
          </h3>
          {marketLed.length === 0 ? (
            <p className="text-sm text-text-dim">None currently — no country shows market pricing meaningfully ahead of its structural fundamentals.</p>
          ) : (
            <ul className="space-y-1">
              {marketLed.map((r) => (
                <li key={r.country} className="text-sm">
                  <span className="font-medium">{r.country}</span>{" "}
                  <span className="text-xs text-text-dim">
                    (market {r.marketScore}, structural {r.structuralScore})
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <p className="mb-4 text-sm text-text-dim">
        <span className="font-medium text-text">{stressedCount} of {countryTable.length}</span> tracked
        emerging markets are currently at Funding-Stress-or-worse (vulnerability score ≥ 60) — the
        contagion-breadth input to the composite score below.
      </p>

      <section className="mb-8">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Sovereign Vulnerability by Country
        </h2>
        <p className="mb-3 max-w-3xl text-xs text-text-dim">
          Structural = World Bank debt/GDP, external debt/GNI, external debt service/exports,
          short-term external debt/reserves, reserve adequacy, current account/GDP, real GDP
          growth and fiscal balance/GDP, cross-sectionally z-scored against the 14-country EM peer
          set (annual data). Market = this engine&apos;s own FX time-series z-score blended with a
          sovereign CDS reading (Damodaran/NYU Stern annual snapshot, where a market actually
          quotes one). &ldquo;Coverage&rdquo; is the fraction of the 8 structural indicators with
          real data for that country — several upper-middle-income EMs sit outside the World
          Bank&apos;s International Debt Statistics scope, and CDS is not quoted for every country.
        </p>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Country</th>
                <th className="px-3 py-2 font-medium">Vulnerability</th>
                <th className="px-3 py-2 font-medium">Structural</th>
                <th className="px-3 py-2 font-medium">Market</th>
                <th className="px-3 py-2 font-medium">Debt/GDP</th>
                <th className="px-3 py-2 font-medium">Ext. Debt/GNI</th>
                <th className="px-3 py-2 font-medium">ST Debt/Reserves</th>
                <th className="px-3 py-2 font-medium">Reserves (mo)</th>
                <th className="px-3 py-2 font-medium">Curr. Acct/GDP</th>
                <th className="px-3 py-2 font-medium">Sov. CDS</th>
                <th className="px-3 py-2 font-medium">FX</th>
                <th className="px-3 py-2 font-medium">Coverage</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((r) => (
                <tr key={r.country} className="border-t border-border align-top">
                  <td className="px-3 py-2">
                    <div className="font-medium">{r.country}</div>
                    {r.latentRisk && (
                      <span className="mt-1 inline-block rounded bg-[#3d2f1d] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e0b93d]">
                        Latent
                      </span>
                    )}
                    {r.marketLedWarning && (
                      <span className="mt-1 ml-1 inline-block rounded bg-[#3d1d1d] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-[#e05a4d]">
                        Market-Led
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="gfew-mono mb-1 font-semibold" style={{ color: scoreColor(r.vulnerabilityScore) }}>
                      {fmtScore(r.vulnerabilityScore)}
                    </div>
                    <RegimePill regime={r.regime} />
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.structuralScore) }}>
                    {fmtScore(r.structuralScore)}
                  </td>
                  <td className="gfew-mono px-3 py-2" style={{ color: scoreColor(r.marketScore) }}>
                    {fmtScore(r.marketScore)}
                  </td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.structural.govt_debt_to_gdp?.value ?? null, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.structural.external_debt_to_gni?.value ?? null, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.structural.short_term_debt_to_reserves?.value ?? null, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.structural.reserves_months_imports?.value ?? null, "mo")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{fmt(r.structural.current_account_to_gdp?.value ?? null, "%")}</td>
                  <td className="gfew-mono px-3 py-2 text-text-dim">{r.sovereignCds.value !== null ? `${Math.round(r.sovereignCds.value)} bps` : "—"}</td>
                  <td className="px-3 py-2 text-text-dim">
                    <div className="gfew-mono">{fmt(r.fx.value, "", 2)}</div>
                    <div className="text-[10px]">{r.fx.pair}</div>
                  </td>
                  <td className="px-3 py-2 text-text-dim">{Math.round(r.dataCompleteness * 100)}%</td>
                </tr>
              ))}
              {countryTable.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-3 py-6 text-center text-text-dim">
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

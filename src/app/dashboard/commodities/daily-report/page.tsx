import Link from "next/link";
import { getDailyReport } from "@/lib/api/engineData";
import type { ReportRow, RegimeLabel } from "@/lib/engines/dailyReport";
import { PrintButton } from "./_PrintButton";

const REGIME_COLORS: Record<RegimeLabel, string> = {
  "Underperforming (Extreme)": "#1a9d6a",
  Underperforming: "#34c085",
  Neutral: "#8b96a8",
  Overheated: "#e0793d",
  "Overheated (Extreme)": "#e05a4d",
};

const REGIME_ACTION: Record<RegimeLabel, string> = {
  "Underperforming (Extreme)": "Data leans: Accumulate",
  Underperforming: "Data leans: Hold / Accumulate",
  Neutral: "Data leans: Hold",
  Overheated: "Data leans: Hold / Trim",
  "Overheated (Extreme)": "Data leans: Trim / Avoid Fresh Buying",
};

function fmtNum(v: number | null, decimals = 0): string {
  if (v === null || Number.isNaN(v)) return "—";
  return v.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function RegimeBadge({ regime }: { regime: RegimeLabel | null }) {
  if (!regime) return null;
  const color = REGIME_COLORS[regime];
  return (
    <span
      className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide"
      style={{ background: `${color}26`, color, border: `1px solid ${color}` }}
    >
      {regime}
    </span>
  );
}

function BriefingCard({ row }: { row: ReportRow }) {
  const color = row.regime ? REGIME_COLORS[row.regime] : "#8b96a8";
  const streakWord = row.streak.direction === 1 ? "up" : row.streak.direction === -1 ? "down" : "flat";

  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-border" style={{ borderLeftWidth: 6, borderLeftColor: color }}>
      <div className="bg-panel p-5">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-text">{row.title}</h3>
            <div className="gfew-mono text-2xl font-bold text-text">
              {fmtNum(row.currentValue, row.currentValue !== null && Math.abs(row.currentValue) >= 100 ? 0 : 2)} {row.unit}
            </div>
            <div className="text-[11px] text-text-dim">as of {row.asOfDate?.slice(0, 10) ?? "—"}</div>
          </div>
          <div className="text-right">
            <RegimeBadge regime={row.regime} />
            <div className="mt-1 text-xs font-semibold" style={{ color }}>
              {row.regime ? REGIME_ACTION[row.regime] : ""}
            </div>
          </div>
        </div>

        <p className="mb-4 rounded p-3 text-sm text-text" style={{ background: `${color}14` }}>
          {row.guidance}
        </p>

        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase tracking-wide text-text-dim">Watch: Lower Level</div>
            <div className="gfew-mono text-base font-semibold" style={{ color: "#34c085" }}>
              {fmtNum(row.watchLow, row.watchLow !== null && Math.abs(row.watchLow) >= 100 ? 0 : 2)} {row.unit}
            </div>
            <div className="text-[10px] text-text-dim">A move down toward here has historically drawn more buying interest.</div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase tracking-wide text-text-dim">{row.fairValue !== null ? "Fair Value Anchor" : "Recent Average"}</div>
            <div className="gfew-mono text-base font-semibold text-text">
              {fmtNum(row.fairValue, row.fairValue !== null && Math.abs(row.fairValue) >= 100 ? 0 : 2)} {row.unit}
            </div>
            <div className="text-[10px] text-text-dim">
              {row.fairValue !== null ? "A real, tested turnaround anchor (see Part 1)." : "Not a proven turnaround target — see Part 1 for why."}
            </div>
          </div>
          <div className="rounded border border-border p-3">
            <div className="text-[10px] uppercase tracking-wide text-text-dim">Watch: Upper Level</div>
            <div className="gfew-mono text-base font-semibold" style={{ color: "#e05a4d" }}>
              {fmtNum(row.watchHigh, row.watchHigh !== null && Math.abs(row.watchHigh) >= 100 ? 0 : 2)} {row.unit}
            </div>
            <div className="text-[10px] text-text-dim">A move up toward here has historically struggled to hold without a pause.</div>
          </div>
        </div>

        <div className="mb-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Probable Turnaround Timeline &amp; Confidence</div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {row.turnaround.map((t, i) => (
              <div key={i} className="rounded bg-panel-raised p-2 text-center">
                <div className="text-[10px] uppercase tracking-wide text-text-dim">{i === 0 ? "Short" : i === 1 ? "Medium" : "Long"} term</div>
                <div className="text-[10px] text-text-dim">{t.timelineLabel}</div>
                <div className="gfew-mono text-lg font-bold text-text">{t.confidencePct !== null ? `${t.confidencePct}%` : "—"}</div>
                <div className="text-[9px] text-text-dim">confidence (n={t.sampleSize})</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded bg-panel-raised p-3 text-xs text-text-dim">
          <strong className="text-text">Current streak:</strong> {row.streak.currentLength} {row.streakPeriodLabel}
          {row.streak.currentLength === 1 ? "" : "s"} in a row moving {streakWord}.{" "}
          {row.streak.continuationPct !== null ? (
            <>
              Historically, streaks at least this long continued <strong className="text-text">{row.streak.continuationPct}% of the time</strong> (out
              of {row.streak.historicalSampleSize} similar past streaks) — meaning it broke the other way about{" "}
              {100 - row.streak.continuationPct}% of the time.
            </>
          ) : (
            "Not enough historical streaks this long yet to estimate an odds."
          )}
        </div>
      </div>
    </div>
  );
}

export default async function DailyReportPage() {
  const report = await getDailyReport();

  return (
    <div className="print-report">
      <style>{`
        @media print {
          header, .no-print { display: none !important; }
          body { background: white !important; }
          .print-report { color: black !important; }
        }
        .print-report, .print-report * { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      `}</style>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-2 flex items-center gap-3 no-print">
          <Link href="/dashboard/commodities" className="text-xs text-accent hover:underline">
            ← Commodities
          </Link>
        </div>

        <div className="mb-8 rounded-xl bg-gradient-to-br from-[#132743] via-[#173a5e] to-[#0d3b3f] p-8 text-white">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-widest text-[#7cc4ff]">Daily Briefing</div>
              <h1 className="mt-1 text-3xl font-bold">Vegetable Oils &amp; Crude Oil — Daily Econometrics Report</h1>
              <p className="mt-2 max-w-2xl text-sm text-[#c7dcf0]">
                Generated {report ? new Date(report.generatedAt).toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" }) : "—"} — every
                number below is recomputed fresh from real market data on each load, not a static snapshot.
              </p>
            </div>
            <PrintButton />
          </div>
        </div>

        {!report && <p className="text-sm text-text-dim">Report data is not yet available.</p>}

        {report && (
          <>
            <section className="mb-10">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold text-text">Part 1 — Full Econometrics Summary</h2>
                <span className="text-xs text-text-dim">The technical detail behind Part 2 below</span>
              </div>
              <p className="mb-4 max-w-3xl text-sm text-text-dim">
                Real Engle-Granger cointegration tests (for the two spreads) and real Augmented Dickey-Fuller
                unit-root tests (for each individual commodity) — computed once via OpenBB&apos;s econometrics
                extension (statsmodels) and documented in full on the pages linked below. This table is the
                condensed reference; Part 2 translates it into plain language.
              </p>
              <div className="overflow-x-auto rounded border border-border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-panel-raised text-text-dim">
                    <tr>
                      <th className="px-3 py-2 font-medium">Instrument</th>
                      <th className="px-3 py-2 font-medium">Type</th>
                      <th className="px-3 py-2 font-medium">Current Value</th>
                      <th className="px-3 py-2 font-medium">Z-Score</th>
                      <th className="px-3 py-2 font-medium">Regime</th>
                      <th className="px-3 py-2 font-medium">Streak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r) => (
                      <tr key={r.id} className="border-t border-border align-top">
                        <td className="px-3 py-2 font-medium text-text">{r.title}</td>
                        <td className="px-3 py-2 text-text-dim">{r.kind === "pair" ? "Cointegrated Pair" : "Individual (ADF-tested)"}</td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">
                          {fmtNum(r.currentValue, r.currentValue !== null && Math.abs(r.currentValue) >= 100 ? 0 : 2)} {r.unit}
                        </td>
                        <td className="gfew-mono px-3 py-2 font-semibold" style={{ color: r.regime ? REGIME_COLORS[r.regime] : undefined }}>
                          {r.zScore !== null ? `${r.zScore >= 0 ? "+" : ""}${r.zScore.toFixed(2)}σ` : "—"}
                        </td>
                        <td className="px-3 py-2">
                          <RegimeBadge regime={r.regime} />
                        </td>
                        <td className="gfew-mono px-3 py-2 text-text-dim">
                          {r.streak.currentLength} {r.streakPeriodLabel}
                          {r.streak.currentLength === 1 ? "" : "s"} {r.streak.direction === 1 ? "up" : r.streak.direction === -1 ? "down" : "flat"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-text-dim">
                Full methodology, ADF/cointegration statistics, price bands, and the econometrics-terms glossary:{" "}
                <Link href="/dashboard/commodities/oilseeds" className="text-accent hover:underline">
                  Oilseeds page
                </Link>{" "}
                (Soybean Oil, Palm Oil, both spreads) and{" "}
                <Link href="/dashboard/commodities/chemicals" className="text-accent hover:underline">
                  Chemicals page
                </Link>{" "}
                (WTI Crude Oil).
              </p>
            </section>

            <section>
              <div className="mb-4">
                <h2 className="text-xl font-bold text-text">Part 2 — Plain-English Daily Briefing</h2>
                <p className="mt-1 max-w-3xl text-sm text-text-dim">
                  No statistics or economics background needed. Every card below explains, in plain words, what the
                  real test found, what price levels are worth watching, how confident the historical record is, and
                  what the data leans toward — Buy, Sell, or Hold. This is a description of historical tendencies,
                  not personalized advice, and not a guarantee — read the note at the end of each card.
                </p>
              </div>
              {report.rows.map((row) => (
                <BriefingCard key={row.id} row={row} />
              ))}
              <div className="rounded-lg border border-border bg-panel p-4 text-xs text-text-dim">
                <strong className="text-text">What &ldquo;confidence&rdquo; means here:</strong> it&apos;s a plain
                historical percentage — out of every past time this exact situation happened, how often it played
                out the way described. It is not a mathematical certainty, and small sample sizes (shown as
                &ldquo;n=&rdquo;) mean more uncertainty even when the percentage looks confident. Markets can and do
                break from their own history. Nothing on this page is investment advice — see the disclaimer below.
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

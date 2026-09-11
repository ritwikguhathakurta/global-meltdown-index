import { RiskBadge, DirectionArrow } from "./RegimeBadge";
import { StatusPill } from "./StatusPill";
import { InlineDisclaimer } from "./Disclaimer";
import { TrendIndicator } from "./TrendIndicator";
import type { EngineRow, IndicatorRow } from "@/lib/api/types";

function IndicatorTable({ title, rows }: { title: string; rows: IndicatorRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">{title}</h3>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-raised text-text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Indicator</th>
              <th className="px-3 py-2 font-medium">Value</th>
              <th className="px-3 py-2 font-medium">As of</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-t border-border">
                <td className="px-3 py-2">{r.label}</td>
                <td className="gfew-mono px-3 py-2">
                  {r.value === null ? "—" : `${r.value}${r.unit ? " " + r.unit : ""}`}
                  <TrendIndicator value={r.value} previous={r.previousValue} />
                </td>
                <td className="gfew-mono px-3 py-2 text-text-dim">{r.asOf ?? "—"}</td>
                <td className="px-3 py-2">
                  <StatusPill status={r.status} />
                </td>
                <td className="px-3 py-2 text-text-dim">
                  {r.sourceKey} (Tier {r.sourceTier})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function EngineDetail({ title, rows }: { title: string; rows: EngineRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="gfew-panel p-6 text-sm text-text-dim">
        <StatusPill status="UNAVAILABLE" /> No data yet for {title}. Run the pipeline from{" "}
        <code className="gfew-mono">/admin</code> or wait for the next scheduled run.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap gap-4">
        {rows.map((r) => (
          <div key={r.horizon} className="gfew-panel flex min-w-[220px] flex-1 flex-col gap-2 p-5">
            <span className="text-xs uppercase tracking-wide text-text-dim">{r.horizon} term</span>
            <div className="flex items-center gap-2">
              <RiskBadge score={r.score} />
              <DirectionArrow direction={r.direction} />
            </div>
            <span className="text-sm">{r.regime}</span>
            <span className="text-[11px] text-text-dim">
              Confidence {Math.round((r.confidence ?? 0) * 100)}% · Data completeness{" "}
              {Math.round((r.data_completeness ?? 0) * 100)}%
            </span>
          </div>
        ))}
      </div>

      {rows[0] && (
        <>
          <div className="gfew-panel p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Trigger</h3>
            <p className="text-sm text-text-dim">{rows[0].trigger_desc}</p>
            <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-text-dim">Transmission Mechanism</h3>
            <p className="text-sm text-text-dim">{rows[0].transmission_mechanism}</p>
          </div>

          <IndicatorTable title="Leading Indicators" rows={rows[0].leading_indicators} />
          <IndicatorTable title="Coincident Indicators" rows={rows[0].coincident_indicators} />
          <IndicatorTable title="Lagging Indicators" rows={rows[0].lagging_indicators} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="gfew-panel p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">What Would Confirm the Risk</h3>
              <ul className="list-inside list-disc text-sm text-text-dim">
                {rows[0].confirmation_conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="gfew-panel p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">What Would Invalidate the Risk</h3>
              <ul className="list-inside list-disc text-sm text-text-dim">
                {rows[0].invalidation_conditions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          </div>

          <div className="gfew-panel p-5">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">What Has Not Yet Happened</h3>
            <ul className="list-inside list-disc text-sm text-text-dim">
              {rows[0].not_yet_happened.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
          </div>

          {rows[0].amplifiers.length > 0 && (
            <div className="gfew-panel p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Amplifiers</h3>
              <ul className="list-inside list-disc text-sm text-text-dim">
                {rows[0].amplifiers.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          {rows[0].contradictory_evidence.length > 0 && (
            <div className="gfew-panel p-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">Contradictory Evidence</h3>
              <ul className="list-inside list-disc text-sm text-text-dim">
                {rows[0].contradictory_evidence.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-text-dim">
            <span>Methodology {rows[0].methodology_version}</span>
            <span>·</span>
            <span>As of {rows[0].as_of}</span>
            <InlineDisclaimer text="Model estimate — not a guaranteed forecast" />
          </div>
        </>
      )}
    </div>
  );
}

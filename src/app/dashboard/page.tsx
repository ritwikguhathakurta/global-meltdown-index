import Link from "next/link";
import { getAllEnginesLatest, getLatestGfmi } from "@/lib/api/engineData";
import { RiskBadge, DirectionArrow } from "@/components/RegimeBadge";
import { InlineDisclaimer } from "@/components/Disclaimer";

const ENGINE_META: Record<string, { label: string; href: string }> = {
  global_liquidity: { label: "Global Dollar Liquidity", href: "/dashboard/liquidity" },
  credit: { label: "Credit Markets", href: "/dashboard/credit" },
  equity_fragility: { label: "Equity Fragility", href: "/dashboard/equities" },
  us_treasury_sovereign: { label: "US Treasury / Sovereign", href: "/dashboard/treasury" },
  yen_carry: { label: "Yen Carry Stress", href: "/dashboard/yen-carry" },
};

export default async function DashboardPage() {
  const [gfmiRows, engineRows] = await Promise.all([getLatestGfmi(), getAllEnginesLatest("short")]);

  const seen = new Set<string>();
  const engines = (engineRows ?? []).filter((r) => {
    if (seen.has(r.engine_key)) return false;
    seen.add(r.engine_key);
    return true;
  });

  const ranked = [...engines].sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
  const gfmi = gfmiRows?.[0] ?? null;
  const previousGfmi = gfmiRows?.[1] ?? null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Global Financial Risk</h1>

      <section className="mb-8 grid gap-4 sm:grid-cols-[220px_1fr]">
        <div className="gfew-panel flex flex-col items-center justify-center gap-2 p-6">
          <span className="text-xs uppercase tracking-wide text-text-dim">GFMI</span>
          <RiskBadge score={gfmi?.score ?? null} />
          <span className="text-center text-xs text-text-dim">{gfmi?.regime ?? "NO DATA"}</span>
          {previousGfmi && (
            <span className="text-[11px] text-text-dim">
              Previous: {previousGfmi.score} ({previousGfmi.regime}) — Δ{" "}
              {gfmi?.score !== null && gfmi?.score !== undefined && previousGfmi.score !== null
                ? gfmi.score - previousGfmi.score
                : "—"}
            </span>
          )}
          {gfmi?.override_triggered && (
            <span className="rounded bg-[#3d1414] px-2 py-1 text-[11px] text-[#e05a4d]">
              Override: {gfmi.override_triggered}
            </span>
          )}
        </div>
        <div className="gfew-panel p-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-dim">GFMI Composition</h2>
          <p className="text-sm text-text-dim">
            Combines {Object.keys(gfmi?.components ?? {}).length} risk engine(s) with a nonlinear
            multi-shock amplifier ({gfmi?.amplifier_applied ?? "—"}×) applied when multiple engines are
            simultaneously elevated. Not a simple average — see{" "}
            <Link href="/dashboard/methodology" className="text-accent hover:underline">Methodology</Link>.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">Top Global Risks</h2>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Engine</th>
                <th className="px-3 py-2 font-medium">Score</th>
                <th className="px-3 py-2 font-medium">Direction</th>
                <th className="px-3 py-2 font-medium">Regime</th>
                <th className="px-3 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((e) => (
                <tr key={e.engine_key} className="border-t border-border hover:bg-panel-raised">
                  <td className="px-3 py-2">
                    <Link href={ENGINE_META[e.engine_key]?.href ?? "#"} className="hover:text-accent">
                      {ENGINE_META[e.engine_key]?.label ?? e.engine_key}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <RiskBadge score={e.score} />
                  </td>
                  <td className="px-3 py-2">
                    <DirectionArrow direction={e.direction} />
                  </td>
                  <td className="px-3 py-2 text-text-dim">{e.regime}</td>
                  <td className="px-3 py-2 text-text-dim">{Math.round((e.confidence ?? 0) * 100)}%</td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-text-dim">
                    No engine data yet — trigger a pipeline run from /admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="gfew-panel p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Next 7 Days</h3>
          <p className="text-sm text-text-dim">Event calendar not yet populated (Phase 2).</p>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Next 30 Days</h3>
          <p className="text-sm text-text-dim">Event calendar not yet populated (Phase 2).</p>
        </div>
        <div className="gfew-panel p-4">
          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-dim">Next 90 Days</h3>
          <p className="text-sm text-text-dim">Event calendar not yet populated (Phase 2).</p>
        </div>
      </section>

      <InlineDisclaimer text="Current macro/market assessment — not a guaranteed forecast or investment recommendation" />
    </div>
  );
}

import Link from "next/link";
import { getLatestGfmi, getLatestIndiaRegime } from "@/lib/api/engineData";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RiskBadge } from "@/components/RegimeBadge";
import { StatusPill } from "@/components/StatusPill";

async function getShortHorizonEngineRows() {
  if (!isSupabaseConfigured) return [] as { engine_key: string; score: number | null; regime: string }[];
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("risk_engine_scores")
      .select("engine_key, as_of, score, regime, direction, confidence")
      .eq("horizon", "short")
      .order("as_of", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return data ?? [];
  } catch (e) {
    console.error((e as Error).message);
    return [];
  }
}

async function getHomeData() {
  const [gfmiRows, engineRows, indiaRows] = await Promise.all([
    getLatestGfmi(),
    getShortHorizonEngineRows(),
    getLatestIndiaRegime(),
  ]);

  const seen = new Set<string>();
  const engines = (engineRows ?? []).filter((r) => {
    if (seen.has(r.engine_key)) return false;
    seen.add(r.engine_key);
    return true;
  });

  return { gfmi: gfmiRows?.[0] ?? null, previousGfmi: gfmiRows?.[1] ?? null, engines, india: indiaRows ?? [] };
}

const ENGINE_LABELS: Record<string, string> = {
  global_liquidity: "Global Liquidity",
  credit: "Credit",
  equity_fragility: "Equity Fragility",
  us_treasury_sovereign: "US Treasury / Sovereign",
  yen_carry: "Yen Carry",
};

export default async function HomePage() {
  const { gfmi, previousGfmi, engines, india } = await getHomeData();
  const hasData = gfmi !== null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <section className="mb-10">
        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          See financial stress before it becomes a market story.
        </h1>
        <p className="mt-3 max-w-2xl text-text-dim">
          A leading-indicator early-warning system for global systemic risk and the India market regime —
          not another lagging market dashboard.
        </p>
      </section>

      {!hasData && (
        <div className="gfew-panel mb-8 px-4 py-3 text-sm text-text-dim">
          <StatusPill status="UNAVAILABLE" /> No pipeline run has completed yet. Once the daily pipeline
          runs (or is triggered manually — see <code className="gfew-mono">/admin</code>), GFMI and engine
          scores will populate here.
        </div>
      )}

      {hasData && (
        <section className="mb-10 grid gap-4 sm:grid-cols-[220px_1fr]">
          <div className="gfew-panel flex flex-col items-center justify-center gap-2 p-6">
            <span className="text-xs uppercase tracking-wide text-text-dim">GFMI</span>
            <RiskBadge score={gfmi!.score} />
            <span className="text-center text-xs text-text-dim">{gfmi!.regime}</span>
            {previousGfmi && (
              <span className="text-[11px] text-text-dim">
                Previous: {previousGfmi.score} ({previousGfmi.regime})
              </span>
            )}
            <span className="text-[11px] text-text-dim">Confidence: {Math.round((gfmi!.confidence ?? 0) * 100)}%</span>
          </div>
          <div className="gfew-panel grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            {engines.map((e) => (
              <div key={e.engine_key} className="flex flex-col gap-1 rounded border border-border p-3">
                <span className="text-xs text-text-dim">{ENGINE_LABELS[e.engine_key] ?? e.engine_key}</span>
                <RiskBadge score={e.score} />
                <span className="text-[11px] text-text-dim">{e.regime}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {india.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">India Market Regime</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {india.map((r) => (
              <div key={r.horizon} className="gfew-panel p-4">
                <span className="text-xs uppercase text-text-dim">{r.horizon} term</span>
                <div className="mt-1 text-lg font-semibold">{r.classification ?? "N/A"}</div>
                <div className="text-xs text-text-dim">Score: {r.score ?? "N/A"} · Confidence: {Math.round((r.confidence ?? 0) * 100)}%</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10 grid gap-6 sm:grid-cols-2">
        <div className="gfew-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">What Has Already Happened</h2>
          <p className="text-sm text-text-dim">
            Verified, observed data points from official and market sources — see each engine page for its
            leading, coincident and lagging indicator breakdown.
          </p>
        </div>
        <div className="gfew-panel p-5">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-text-dim">What May Matter Next</h2>
          <p className="text-sm text-text-dim">
            Forward-looking interpretation, scenario analysis and central-bank forward guidance — always
            labeled distinctly from verified fact. See <Link href="/dashboard/methodology" className="text-accent hover:underline">Methodology</Link>.
          </p>
        </div>
      </section>

      <section className="gfew-panel flex flex-col gap-3 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-dim">Ask Global Meltdown Index Anything</h2>
        <p className="text-sm text-text-dim">
          The conversational AI research agent is planned for a later phase — it requires its own LLM API
          key and billing, kept separate from the core risk-engine data below.
        </p>
        <div className="rounded border border-border bg-panel-raised px-3 py-2 text-sm text-text-dim opacity-60">
          Coming soon — &ldquo;Is the yen carry trade becoming dangerous?&rdquo;
        </div>
      </section>

      <section className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/signup" className="rounded bg-accent px-5 py-2.5 text-sm font-medium text-[#061018] hover:opacity-90">
          Start free trial
        </Link>
        <Link href="/dashboard/methodology" className="text-sm text-text-dim hover:text-text">
          Read the methodology →
        </Link>
      </section>
    </div>
  );
}

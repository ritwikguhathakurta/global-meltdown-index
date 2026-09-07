import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function LiquidityPage() {
  const rows = await getLatestEngine("global_liquidity");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Global Liquidity (G7 + China)</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        Fed, ECB (Germany/France/Italy), BOJ, BoE and BoC balance-sheet/reserve measures, plus China&apos;s
        3-month interbank rate as a rate-side liquidity proxy (no free, verified PBOC balance-sheet series
        was found) — see the methodology page for the full sourcing detail on each.
      </p>
      <EngineDetail title="Global Liquidity" rows={rows} />
    </div>
  );
}

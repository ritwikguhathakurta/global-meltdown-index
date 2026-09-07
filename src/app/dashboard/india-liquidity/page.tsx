import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function IndiaLiquidityPage() {
  const rows = await getLatestEngine("india_liquidity");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">India Liquidity</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        RBI&apos;s own daily net systemic liquidity (LAF injection/absorption) and the Weighted Average
        Call Rate, plus USDINR as a cross-check — separate from India Market Regime, which is a
        bullish/bearish equity-direction read rather than a banking-system liquidity read.
      </p>
      <EngineDetail title="India Liquidity" rows={rows} />
    </div>
  );
}

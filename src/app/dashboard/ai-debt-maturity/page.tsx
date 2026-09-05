import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function AiDebtMaturityPage() {
  const rows = await getLatestEngine("ai_debt_maturity_wall");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">AI Debt Maturity Wall</h1>
      <EngineDetail title="AI Debt Maturity Wall" rows={rows} />
    </div>
  );
}

import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function AiFinancialSustainabilityPage() {
  const rows = await getLatestEngine("ai_financial_sustainability");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">AI Financial Sustainability</h1>
      <EngineDetail title="AI Financial Sustainability" rows={rows} />
    </div>
  );
}

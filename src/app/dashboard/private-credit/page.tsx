import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function PrivateCreditPage() {
  const rows = await getLatestEngine("private_credit");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Private Credit</h1>
      <EngineDetail title="Private Credit" rows={rows} />
    </div>
  );
}

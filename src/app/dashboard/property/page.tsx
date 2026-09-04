import { getLatestEngine } from "@/lib/api/engineData";
import { EngineDetail } from "@/components/EngineDetail";

export default async function PropertyPage() {
  const rows = await getLatestEngine("property");
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Property / CRE</h1>
      <EngineDetail title="Property / CRE" rows={rows} />
    </div>
  );
}

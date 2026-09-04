import { getSourceRegistry, getRecentPipelineRuns } from "@/lib/api/engineData";

const TIER_LABEL: Record<number, string> = {
  1: "Tier 1 — Official primary",
  2: "Tier 2 — Multilateral institution",
  3: "Tier 3 — Licensed market-data aggregator",
  4: "Tier 4 — Licensed financial news",
  5: "Tier 5 — Verified official social media",
};

export default async function SourcesPage() {
  const [sources, runs] = await Promise.all([getSourceRegistry(), getRecentPipelineRuns(10)]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">Source Registry</h1>

      <div className="mb-8 overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-raised text-text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Institution</th>
              <th className="px-3 py-2 font-medium">Tier</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">URL</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="px-3 py-2">{s.name}</td>
                <td className="px-3 py-2 text-text-dim">{s.institution}</td>
                <td className="px-3 py-2 text-text-dim">{TIER_LABEL[s.tier] ?? s.tier}</td>
                <td className="px-3 py-2 text-text-dim">{s.status}</td>
                <td className="px-3 py-2">
                  <a href={s.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {s.url}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">Recent Pipeline Runs</h2>
      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-raised text-text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Started</th>
              <th className="px-3 py-2 font-medium">Stage</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="gfew-mono px-3 py-2 text-text-dim">{new Date(r.started_at).toLocaleString()}</td>
                <td className="px-3 py-2">{r.stage}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="gfew-mono px-3 py-2 text-xs text-text-dim">{JSON.stringify(r.detail)}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-dim">
                  No pipeline runs recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

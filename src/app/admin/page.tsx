import { getRecentPipelineRuns, getSourceRegistry } from "@/lib/api/engineData";
import { TriggerPipelineButton } from "./TriggerPipelineButton";

export default async function AdminPage() {
  const [runs, sources] = await Promise.all([getRecentPipelineRuns(30), getSourceRegistry()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Admin</h1>
      <p className="mb-6 text-sm text-text-dim">
        Access is enforced server-side (proxy.ts checks <code className="gfew-mono">profiles.role = &apos;admin&apos;</code>) —
        reaching this page at all means you&apos;re authorized.
      </p>

      <section className="gfew-panel mb-8 p-5">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">
          Manual Pipeline Trigger
        </h2>
        <p className="mb-3 text-sm text-text-dim">
          The automated daily run is scheduled via Vercel Cron (see <code className="gfew-mono">vercel.json</code>)
          inside the after-US-close / before-Tokyo-open window. Use this only for testing or recovery after a
          failed run.
        </p>
        <TriggerPipelineButton />
      </section>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">Pipeline Run Log</h2>
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
                  <td className="px-3 py-2">
                    <span
                      className={
                        r.status === "ok"
                          ? "text-[#34c085]"
                          : r.status === "warning"
                            ? "text-[#e0b93d]"
                            : "text-[#e05a4d]"
                      }
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="gfew-mono max-w-md truncate px-3 py-2 text-xs text-text-dim">{JSON.stringify(r.detail)}</td>
                </tr>
              ))}
              {runs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-text-dim">
                    No runs yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-text-dim">Source Registry</h2>
        <div className="overflow-x-auto rounded border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-panel-raised text-text-dim">
              <tr>
                <th className="px-3 py-2 font-medium">Key</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.id} className="border-t border-border">
                  <td className="gfew-mono px-3 py-2 text-text-dim">{s.key}</td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2 text-text-dim">{s.tier}</td>
                  <td className="px-3 py-2 text-text-dim">{s.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

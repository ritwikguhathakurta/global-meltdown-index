import { getRecentCentralBankEvents } from "@/lib/api/engineData";
import { StatusPill } from "@/components/StatusPill";

export default async function CentralBanksPage() {
  const events = await getRecentCentralBankEvents(50);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold">Central Bank Intelligence</h1>
      <p className="mb-6 max-w-2xl text-sm text-text-dim">
        Headline-level tracking of official press releases from the Federal Reserve, ECB, Bank of England
        and RBI (more institutions to be added). Hawkishness/dovishness NLP scoring and stance-change
        detection (V3 §8-10) is not implemented yet — this phase only captures what was published, when,
        and links to the primary source.
      </p>

      <div className="overflow-x-auto rounded border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-panel-raised text-text-dim">
            <tr>
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Institution</th>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className="border-t border-border">
                <td className="gfew-mono px-3 py-2 text-text-dim">{e.event_date}</td>
                <td className="px-3 py-2">{e.institution}</td>
                <td className="px-3 py-2">{e.title}</td>
                <td className="px-3 py-2">
                  <a href={e.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    Primary source
                  </a>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-text-dim">
                  <StatusPill status="UNAVAILABLE" /> No events ingested yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import AdmZip from "adm-zip";
import type { MetricPoint } from "../metrics/store";

/**
 * GDELT 2.0 Event Database — free, public, no key, updated every 15 minutes:
 *
 *   http://data.gdeltproject.org/gdeltv2/lastupdate.txt   (points at the 3 latest files)
 *   http://data.gdeltproject.org/gdeltv2/<timestamp>.export.CSV.zip
 *
 * A zipped, tab-separated, 61-column file per 15-minute window (verified live,
 * 2026-09-29: a real ~1,300-event file). This is GDELT's actual event/CAMEO
 * database — distinct from gdeltNews.ts, which only calls GDELT's headline-only
 * DOC 2.0 API for the World News page.
 *
 * Column indices used (per GDELT's own published 2.0 column layout):
 *   28 EventRootCode, 29 QuadClass (1=Verbal Coop, 2=Material Coop,
 *   3=Verbal Conflict, 4=Material Conflict), 30 GoldsteinScale (-10..+10,
 *   a real, if automated-and-noisy, escalation/cooperation intensity score),
 *   33 NumArticles.
 *
 * Fetches the most recent SAMPLE_WINDOW 15-minute files (not all ~96/day —
 * that would mean ~96 zip downloads per pipeline run) and aggregates GLOBALLY
 * (no per-country breakdown in this pass: ActionGeo_CountryCode is FIPS
 * 10-4, not ISO, and mapping it correctly to this project's other
 * country-keyed metrics is real work deferred rather than guessed at). The
 * result is a real but explicitly coarse, automated-text-derived escalation
 * proxy — disclosed as such wherever shown, the same caveat GDELT's own
 * documentation gives (this is machine event-coding of news text, not
 * verified intelligence).
 */
const LASTUPDATE_URL = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt";
const SAMPLE_WINDOW = 6; // 6 x 15min = 90 minutes of real events, sampled each pipeline run
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };

async function latestExportUrl(): Promise<string> {
  const res = await fetch(LASTUPDATE_URL, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`GDELT lastupdate.txt: HTTP ${res.status}`);
  const text = await res.text();
  const line = text.split("\n").find((l) => l.includes(".export.CSV.zip"));
  if (!line) throw new Error("GDELT lastupdate.txt: no export.CSV.zip entry found");
  const url = line.trim().split(/\s+/).pop();
  if (!url) throw new Error("GDELT lastupdate.txt: could not parse export file URL");
  return url;
}

function priorTimestampUrl(url: string, stepsBack: number): string {
  const m = /(\d{14})\.export\.CSV\.zip$/.exec(url);
  if (!m) throw new Error(`GDELT export URL: unexpected filename shape (${url})`);
  const d = new Date(
    Date.UTC(
      Number(m[1].slice(0, 4)),
      Number(m[1].slice(4, 6)) - 1,
      Number(m[1].slice(6, 8)),
      Number(m[1].slice(8, 10)),
      Number(m[1].slice(10, 12)) - 15 * stepsBack
    )
  );
  const ts = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}00`;
  return url.replace(m[1], ts);
}

async function fetchEventRows(url: string): Promise<string[][]> {
  const res = await fetch(url, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) return []; // a specific 15-min slot can legitimately not exist yet/anymore; skip, don't fail the whole run
  const buf = Buffer.from(await res.arrayBuffer());
  const zip = new AdmZip(buf);
  const entry = zip.getEntries()[0];
  if (!entry) return [];
  return zip
    .readAsText(entry)
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"));
}

export async function fetchGdeltEscalation(): Promise<MetricPoint[]> {
  const latest = await latestExportUrl();
  const urls = [latest, ...Array.from({ length: SAMPLE_WINDOW - 1 }, (_, i) => priorTimestampUrl(latest, i + 1))];

  let totalEvents = 0;
  let goldsteinSum = 0;
  let goldsteinCount = 0;
  let conflictEvents = 0;
  let coopEvents = 0;
  let totalArticles = 0;

  for (const url of urls) {
    const rows = await fetchEventRows(url);
    for (const r of rows) {
      if (r.length < 34) continue;
      totalEvents++;
      const quadClass = Number(r[29]);
      const goldstein = Number(r[30]);
      const numArticles = Number(r[33]);
      if (Number.isFinite(goldstein)) {
        goldsteinSum += goldstein;
        goldsteinCount++;
      }
      if (quadClass === 3 || quadClass === 4) conflictEvents++;
      else if (quadClass === 1 || quadClass === 2) coopEvents++;
      if (Number.isFinite(numArticles)) totalArticles += numArticles;
    }
  }
  if (totalEvents === 0) throw new Error("GDELT events: no rows parsed from any sampled window");

  const observed_at = new Date().toISOString().slice(0, 10);
  const base = { observed_at, source_key: "gdelt_events", source_tier: 2 as const, frequency: "daily" as const };
  return [
    { ...base, metric_key: "geopolitical.gdelt.avg_goldstein", value: goldsteinSum / goldsteinCount, unit: "index (-10..+10)" },
    { ...base, metric_key: "geopolitical.gdelt.conflict_event_share", value: conflictEvents / totalEvents, unit: "fraction" },
    { ...base, metric_key: "geopolitical.gdelt.cooperation_event_share", value: coopEvents / totalEvents, unit: "fraction" },
    { ...base, metric_key: "geopolitical.gdelt.event_count_sampled", value: totalEvents, unit: "events" },
    { ...base, metric_key: "geopolitical.gdelt.article_volume_sampled", value: totalArticles, unit: "articles" },
  ];
}

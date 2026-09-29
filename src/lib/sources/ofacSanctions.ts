import type { MetricPoint } from "../metrics/store";

/**
 * US Treasury OFAC Specially Designated Nationals (SDN) list — free, official,
 * no key. Verified live (2026-09-29): a real 19,000+ row CSV, refreshed by
 * Treasury whenever the list changes:
 *
 *   https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV
 *
 * No header row. Columns (per OFAC's own published SDN.CSV layout):
 * ent_num, SDN_Name, SDN_Type, Program, Title, Call_Sign, Vess_type, Tonnage,
 * GRT, Vess_flag, Vess_owner, Remarks. `Program` is a sanctions-program code
 * (e.g. "RUSSIA-EO14024", "IRAN-EO13902", "DPRK4") — genuinely multi-valued
 * per entry, rendered as bracket-joined codes ("[NPWMD] [IFSR]") when an
 * entry is designated under more than one program.
 *
 * Counted here: the number of currently-listed SDN entries whose Program
 * field contains each tracked keyword — a real, sourced sanctions-intensity
 * proxy (how many entities/individuals/vessels are actually on the list
 * under each program right now), not a fabricated severity score. A rising
 * count is a genuine signal of expanding designations under that program;
 * this says nothing about economic magnitude, which OFAC doesn't publish.
 */
const SDN_URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV";
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; GlobalMeltdownIndex/1.0)" };

const PROGRAM_KEYWORDS: { keyword: string; slug: string }[] = [
  { keyword: "RUSSIA", slug: "russia" },
  { keyword: "IRAN", slug: "iran" },
  { keyword: "DPRK", slug: "north_korea" },
  { keyword: "CUBA", slug: "cuba" },
  { keyword: "VENEZUELA", slug: "venezuela" },
  { keyword: "SYRIA", slug: "syria" },
  { keyword: "BELARUS", slug: "belarus" },
  { keyword: "UKRAINE", slug: "ukraine_related" },
  { keyword: "SDGT", slug: "terrorism" },
  { keyword: "NPWMD", slug: "weapons_proliferation" },
];

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === "," && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export async function fetchOfacSanctions(): Promise<MetricPoint[]> {
  const res = await fetch(SDN_URL, { headers: HEADERS, next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`OFAC SDN list: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 1000) throw new Error(`OFAC SDN list: unexpectedly small (${lines.length} rows) — possible format change`);

  const counts = new Map(PROGRAM_KEYWORDS.map((p) => [p.slug, 0]));
  for (const line of lines) {
    const fields = splitCsvLine(line);
    const program = (fields[3] ?? "").toUpperCase();
    for (const { keyword, slug } of PROGRAM_KEYWORDS) {
      if (program.includes(keyword)) counts.set(slug, (counts.get(slug) ?? 0) + 1);
    }
  }

  const observed_at = new Date().toISOString().slice(0, 10);
  const points: MetricPoint[] = [];
  for (const { slug } of PROGRAM_KEYWORDS) {
    const n = counts.get(slug) ?? 0;
    if (n === 0) continue;
    points.push({
      metric_key: `geopolitical.ofac_sdn_count.${slug}`,
      observed_at,
      value: n,
      unit: "entities listed",
      source_key: "ofac_sdn",
      source_tier: 1,
      frequency: "daily",
    });
  }
  if (points.length === 0) throw new Error("OFAC SDN list: no tracked program keywords matched any entry");
  return points;
}

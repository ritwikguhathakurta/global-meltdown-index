import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import readline from "node:readline";
import type { MetricPoint } from "../metrics/store";
import { BALANCE_COMMODITIES } from "../commodities/balanceTaxonomy";

/**
 * FAOSTAT "Production_Crops_Livestock" bulk data — free, no key, no login.
 * Annual world production for commodities USDA PSD doesn't track (Cocoa,
 * Tea, Rubber, Tobacco), since PSD only covers the crops/livestock USDA
 * itself forecasts for U.S. trade policy purposes. This is production
 * only — FAOSTAT does not publish consumption/stocks in this domain (that
 * lives in a separate, much coarser "Food Balances" domain reported in
 * per-capita/food-use terms, not a clean industry consumption figure
 * comparable to USDA PSD's) — so these commodities show "—" for
 * consumption/stocks/stocks-to-use on the balance table, not a fabricated
 * number.
 *
 * FAOSTAT's own live JSON API (fenixservices.fao.org) is unreachable from
 * this environment (TLS connects but the request hangs indefinitely,
 * consistent with a bot challenge that never resolves for non-browser
 * clients) — the bulk CSV download, served from S3/CloudFront, has no such
 * issue:
 *
 * https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data.zip
 *
 * That zip contains both a flagged and a "_NOFLAG" CSV (same data, minus
 * FAO's estimate/imputation flag column) — this uses the NOFLAG entry
 * since flags aren't needed here, verified live to exist inside the zip
 * rather than guessed as a separate top-level download (a guessed
 * `..._NOFLAG.zip` URL returns a 403 from S3 — it isn't a real object).
 *
 * Its "World" row (Area Code 5000) is a pre-computed aggregate published
 * by FAO itself, unlike USDA PSD's bulk file — no summing or EU-style
 * double-counting risk here.
 */

const FAOSTAT_ZIP_URL = "https://bulks-faostat.fao.org/production/Production_Crops_Livestock_E_All_Data.zip";
const WORLD_AREA_CODE = "5000";
const PRODUCTION_ELEMENT_CODE = "5510";

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

export async function fetchFaostatProduction(): Promise<MetricPoint[]> {
  const wantedItems = new Map(BALANCE_COMMODITIES.filter((c) => c.source === "faostat").map((c) => [c.sourceCode, c]));
  if (wantedItems.size === 0) return [];

  const res = await fetch(FAOSTAT_ZIP_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FAOSTAT bulk download: HTTP ${res.status}`);
  const zipBuffer = Buffer.from(await res.arrayBuffer());

  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.toUpperCase().includes("NOFLAG") && e.entryName.toLowerCase().endsWith(".csv"));
  if (!entry) throw new Error("FAOSTAT bulk download: no NOFLAG CSV entry found in zip");
  const csvBuffer = entry.getData();

  const rl = readline.createInterface({ input: Readable.from(csvBuffer), crlfDelay: Infinity });
  let header: string[] | null = null;
  const points: MetricPoint[] = [];

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    if (!line) continue;
    const fields = parseCsvLine(line);
    const areaCode = fields[0];
    if (areaCode !== WORLD_AREA_CODE) continue;
    const itemCode = fields[3].replace(/^'/, "");
    const commodity = wantedItems.get(itemCode);
    if (!commodity) continue;
    const elementCode = fields[6];
    if (elementCode !== PRODUCTION_ELEMENT_CODE) continue;

    for (let col = 9; col < header.length; col++) {
      const yearMatch = header[col].match(/^Y(\d{4})$/);
      if (!yearMatch) continue;
      const raw = fields[col];
      if (!raw) continue;
      const tonnes = parseFloat(raw);
      if (Number.isNaN(tonnes)) continue;
      points.push({
        metric_key: `commodity.${commodity.slug}.production`,
        observed_at: `${yearMatch[1]}-12-31`,
        value: tonnes / 1_000_000,
        unit: commodity.unit,
        source_key: "faostat",
        source_tier: 1,
        frequency: "annual",
      });
    }
  }
  return points;
}

// Country-level palm oil production for the Oilseeds sub-module — same bulk
// file and item (257, "Palm oil"), but filtered by country Area Code instead
// of the World aggregate above. Long-run annual context (1961-) for
// Indonesia in particular, which otherwise only has ~1-2 years of monthly
// BPS data. Cross-checked live: Malaysia's 2023 figure here (18.55M MT)
// matches MPOB's own monthly-aggregated 2023 total almost exactly.
//
// Extended for the Oleochemicals engine's lauric-oil feedstock chain
// (PKO/coconut oil -> lauric acid -> surfactants, oleochemValueChain.ts) with
// Coconut Oil (item 252) for the Philippines, Indonesia and Malaysia — the
// world's three largest producers, in that order. Area/item codes verified
// live against this same bulk file before use (Philippines = Area Code 171,
// Coconut oil = Item Code 252, both cross-checked against the file's own
// Area/Item name columns, not guessed); the resulting 2022-2023 figures
// (Philippines ~1.2-1.4M MT, Indonesia ~650K MT, Malaysia ~55K MT) match the
// known real-world production ranking.
const OILSEEDS_COUNTRY_AREA_CODES: Record<string, string> = { "101": "indonesia", "131": "malaysia", "171": "philippines" };
const PALM_OIL_ITEM_CODE = "257";
const COCONUT_OIL_ITEM_CODE = "252";
const OILSEEDS_COUNTRY_ITEMS: { itemCode: string; commoditySlug: string }[] = [
  { itemCode: PALM_OIL_ITEM_CODE, commoditySlug: "palm_oil" },
  { itemCode: COCONUT_OIL_ITEM_CODE, commoditySlug: "coconut_oil" },
];

export async function fetchFaostatOilseedsCountryProduction(): Promise<MetricPoint[]> {
  const res = await fetch(FAOSTAT_ZIP_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`FAOSTAT bulk download: HTTP ${res.status}`);
  const zipBuffer = Buffer.from(await res.arrayBuffer());

  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.toUpperCase().includes("NOFLAG") && e.entryName.toLowerCase().endsWith(".csv"));
  if (!entry) throw new Error("FAOSTAT bulk download: no NOFLAG CSV entry found in zip");
  const csvBuffer = entry.getData();

  const itemBySlug = new Map(OILSEEDS_COUNTRY_ITEMS.map((i) => [i.itemCode, i.commoditySlug]));

  const rl = readline.createInterface({ input: Readable.from(csvBuffer), crlfDelay: Infinity });
  let header: string[] | null = null;
  const points: MetricPoint[] = [];

  for await (const line of rl) {
    if (!header) {
      header = parseCsvLine(line);
      continue;
    }
    if (!line) continue;
    const fields = parseCsvLine(line);
    const country = OILSEEDS_COUNTRY_AREA_CODES[fields[0]];
    if (!country) continue;
    const itemCode = fields[3].replace(/^'/, "");
    const commoditySlug = itemBySlug.get(itemCode);
    if (!commoditySlug) continue;
    const elementCode = fields[6];
    if (elementCode !== PRODUCTION_ELEMENT_CODE) continue;

    for (let col = 9; col < header.length; col++) {
      const yearMatch = header[col].match(/^Y(\d{4})$/);
      if (!yearMatch) continue;
      const raw = fields[col];
      if (!raw) continue;
      const tonnes = parseFloat(raw);
      if (Number.isNaN(tonnes)) continue;
      points.push({
        metric_key: `commodity.${commoditySlug}.${country}.production_annual`,
        observed_at: `${yearMatch[1]}-12-31`,
        value: tonnes / 1_000_000,
        unit: "million MT",
        source_key: "faostat",
        source_tier: 1,
        frequency: "annual",
      });
    }
  }
  return points;
}

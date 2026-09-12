import AdmZip from "adm-zip";
import { Readable } from "node:stream";
import readline from "node:readline";
import type { MetricPoint } from "../metrics/store";
import { BALANCE_COMMODITIES } from "../commodities/balanceTaxonomy";
import { SOYBEAN_COUNTRIES, SOYBEAN_PSD_CODE } from "../commodities/oilseedsTaxonomy";

/**
 * USDA FAS Production, Supply and Distribution (PSD) — free, no key, no
 * login. Annual world agricultural commodity balances (production,
 * consumption, ending stocks, and — for oilseeds — crush), updated
 * ~monthly. This is the bulk CSV
 * download, not the gated apps.fas.usda.gov/OpenData API (which needs an
 * API key) — the bulk file needs no auth at all and carries the full
 * ~2 million row history for every commodity/country/year:
 *
 * https://apps.fas.usda.gov/psdonline/downloads/psd_alldata_csv.zip
 *
 * World totals are NOT a plain sum-all-countries: PSD sometimes reports EU
 * production only as a bloc (codes E2 "EU-15", E3 "EU-25", E4 "European
 * Union") with no individual member rows (true for Wheat, for example —
 * summing every country while excluding the EU bloc code undercounts world
 * wheat production by ~15%, verified live), and sometimes reports EU
 * members individually alongside the bloc for the same years (true for
 * Sugar, 2001-2005) — summing both there would double-count. The rule
 * applied per commodity/attribute/year: use the sum of individual EU
 * member rows if any exist for that year, otherwise fall back to the EU
 * bloc row.
 */

const PSD_ZIP_URL = "https://apps.fas.usda.gov/psdonline/downloads/psd_alldata_csv.zip";

const EU_MEMBER_CODES = new Set([
  "AU", "BE", "BU", "HR", "CY", "EZ", "DA", "EN", "FI", "FR", "GM", "GE", "GR", "HU", "EI", "IT",
  "LG", "LH", "LU", "S8", "MT", "NL", "PL", "PO", "RO", "LO", "SI", "SP", "SW",
]);
const EU_AGGREGATE_CODES = new Set(["E2", "E3", "E4"]);

const CONSUMPTION_ATTRIBUTES = new Set(["Domestic Consumption", "Domestic Use", "Human Dom. Consumption"]);

type Attribute = "production" | "consumption" | "ending_stocks" | "crush";

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

type YearBucket = { nonEu: number; euMembers: number; euAggregate: number };
// commodityCode -> attribute -> year -> bucket
type Aggregation = Map<string, Map<Attribute, Map<string, YearBucket>>>;

async function downloadPsdCsv(): Promise<Buffer> {
  const res = await fetch(PSD_ZIP_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`USDA PSD bulk download: HTTP ${res.status}`);
  const zipBuffer = Buffer.from(await res.arrayBuffer());

  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith(".csv"));
  if (!entry) throw new Error("USDA PSD bulk download: no CSV entry found in zip");
  return entry.getData();
}

export async function fetchUsdaPsdBalances(): Promise<MetricPoint[]> {
  const wantedCodes = new Map(BALANCE_COMMODITIES.filter((c) => c.source === "usda_psd").map((c) => [c.sourceCode, c]));
  const csvBuffer = await downloadPsdCsv();

  const aggregation: Aggregation = new Map();

  const rl = readline.createInterface({ input: Readable.from(csvBuffer), crlfDelay: Infinity });
  let isFirstLine = true;
  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }
    if (!line) continue;
    const fields = parseCsvLine(line);
    const commodityCode = fields[0];
    if (!wantedCodes.has(commodityCode)) continue;

    const countryCode = fields[2];
    const marketYear = fields[4];
    const attributeDescription = fields[8];
    const rawValue = fields[11];

    let attribute: Attribute | null = null;
    if (attributeDescription === "Production") attribute = "production";
    else if (CONSUMPTION_ATTRIBUTES.has(attributeDescription)) attribute = "consumption";
    else if (attributeDescription === "Ending Stocks") attribute = "ending_stocks";
    else if (attributeDescription === "Crush") attribute = "crush";
    if (!attribute) continue;

    const value = parseFloat(rawValue);
    if (Number.isNaN(value)) continue;

    let byAttribute = aggregation.get(commodityCode);
    if (!byAttribute) {
      byAttribute = new Map();
      aggregation.set(commodityCode, byAttribute);
    }
    let byYear = byAttribute.get(attribute);
    if (!byYear) {
      byYear = new Map();
      byAttribute.set(attribute, byYear);
    }
    let bucket = byYear.get(marketYear);
    if (!bucket) {
      bucket = { nonEu: 0, euMembers: 0, euAggregate: 0 };
      byYear.set(marketYear, bucket);
    }
    if (EU_AGGREGATE_CODES.has(countryCode)) bucket.euAggregate += value;
    else if (EU_MEMBER_CODES.has(countryCode)) bucket.euMembers += value;
    else bucket.nonEu += value;
  }

  const points: MetricPoint[] = [];
  for (const commodity of BALANCE_COMMODITIES) {
    if (commodity.source !== "usda_psd") continue;
    const byAttribute = aggregation.get(commodity.sourceCode);
    if (!byAttribute) continue;
    for (const [attribute, byYear] of byAttribute) {
      for (const [year, bucket] of byYear) {
        const yearNum = parseInt(year, 10);
        if (!Number.isFinite(yearNum)) continue;
        const total = bucket.nonEu + (bucket.euMembers > 0 ? bucket.euMembers : bucket.euAggregate);
        // USDA reports these in thousands of the native unit (e.g. 1000 MT).
        const millionUnits = total / 1000;
        points.push({
          metric_key: `commodity.${commodity.slug}.${attribute}`,
          observed_at: `${year}-12-31`,
          value: millionUnits,
          unit: commodity.unit,
          source_key: "usda_psd",
          source_tier: 1,
          frequency: "annual",
        });
      }
    }
  }
  return points;
}

const COUNTRY_ATTRIBUTES = new Set(["Production", "Crush", "Imports", "Exports", "Ending Stocks"]);

/**
 * Country-level Soybean balance sheet — Oilseeds section (spec §7, §11-15).
 * Unlike the world balance above, these are single reporting-country rows
 * with no EU-bloc double-counting risk (the EU entry here is PSD's own E4
 * bloc figure, reported as its own row, not summed against member states).
 */
export async function fetchUsdaPsdSoybeanCountryBalances(): Promise<MetricPoint[]> {
  const countryBySlug = new Map(SOYBEAN_COUNTRIES.map((c) => [c.psdCountryCode, c]));
  const csvBuffer = await downloadPsdCsv();

  const points: MetricPoint[] = [];
  const rl = readline.createInterface({ input: Readable.from(csvBuffer), crlfDelay: Infinity });
  let isFirstLine = true;
  for await (const line of rl) {
    if (isFirstLine) {
      isFirstLine = false;
      continue;
    }
    if (!line) continue;
    const fields = parseCsvLine(line);
    if (fields[0] !== SOYBEAN_PSD_CODE) continue;

    const country = countryBySlug.get(fields[2]);
    if (!country) continue;
    const attributeDescription = fields[8];
    if (!COUNTRY_ATTRIBUTES.has(attributeDescription)) continue;

    const value = parseFloat(fields[11]);
    if (Number.isNaN(value)) continue;

    const attribute = attributeDescription.toLowerCase().replace(/\s+/g, "_"); // "Ending Stocks" -> "ending_stocks"
    points.push({
      metric_key: `commodity.soybeans.country.${country.slug}.${attribute}`,
      observed_at: `${fields[4]}-12-31`,
      value: value / 1000, // USDA reports 1000 MT
      unit: "million MT",
      source_key: "usda_psd",
      source_tier: 1,
      frequency: "annual",
    });
  }
  return points;
}

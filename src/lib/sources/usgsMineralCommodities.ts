import type { MetricPoint } from "../metrics/store";
import { COUNTRY_BALANCE_COMMODITIES } from "../commodities/countryBalanceTaxonomy";

/**
 * USGS National Minerals Information Center — Mineral Commodity Summaries
 * (MCS) bulk data release. Free, no key, no login. Live-verified: usgs.gov
 * itself sits behind a bot-detection WAF that blocks server-side fetches,
 * but the underlying data is hosted on sciencebase.gov (USGS's own data
 * repository), which is NOT behind that WAF.
 *
 * https://www.sciencebase.gov/catalog/item/69837e43b66b01367d7ec7c7 is the
 * MCS2026 release's ScienceBase item; its file list is fetched dynamically
 * (rather than hardcoding the CSV's own download URL, which embeds a
 * content-hash token that changes whenever USGS re-uploads the file) so a
 * same-year re-upload doesn't silently break this connector. The item ID
 * itself is specific to the 2026 edition, though — MCS2027 will need this
 * ID updated, the same "annually rotating source" maintenance this app
 * already accepts for other yearly government publications.
 *
 * Unlike USDA PSD (usdaPsd.ts), MCS is a CURRENT-YEAR SUMMARY, not a long
 * historical series: the bulk file carries only the latest two years per
 * commodity, and PRODUCTION ONLY — no imports/exports/consumption/ending
 * stocks. World-level figures come from each commodity's "World total"
 * row under its own "…, rounded" Statistics_detail variant (individual
 * countries are reported at higher precision under the non-rounded
 * variant, which is why the two are read separately below, not summed).
 * The CSV itself is Windows-1252 encoded, not UTF-8 (confirmed live — its
 * em dashes and accented country names decode to replacement characters
 * under a naive UTF-8 read), so it's decoded explicitly via TextDecoder.
 */

const MCS_ITEM_URL = "https://www.sciencebase.gov/catalog/item/69837e43b66b01367d7ec7c7?format=json";

type ScienceBaseFile = { name?: string; url?: string; downloadUri?: string };

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

async function downloadMcsCsv(): Promise<string> {
  const itemRes = await fetch(MCS_ITEM_URL, { next: { revalidate: 0 } });
  if (!itemRes.ok) throw new Error(`USGS MCS ScienceBase item lookup: HTTP ${itemRes.status}`);
  const item = (await itemRes.json()) as { files?: ScienceBaseFile[] };
  const csvFile = (item.files ?? []).find((f) => typeof f.name === "string" && f.name.toLowerCase().endsWith(".csv"));
  if (!csvFile) throw new Error("USGS MCS: no CSV file found in ScienceBase item metadata");
  const csvUrl = csvFile.url ?? csvFile.downloadUri;
  if (!csvUrl) throw new Error("USGS MCS: CSV file entry has no download URL");

  const csvRes = await fetch(csvUrl, { next: { revalidate: 0 } });
  if (!csvRes.ok) throw new Error(`USGS MCS CSV download: HTTP ${csvRes.status}`);
  const buf = Buffer.from(await csvRes.arrayBuffer());
  return new TextDecoder("windows-1252").decode(buf);
}

export async function fetchUsgsMineralCommodities(): Promise<MetricPoint[]> {
  const commodities = COUNTRY_BALANCE_COMMODITIES.filter((c) => c.source === "usgs_mcs");
  if (commodities.length === 0) return [];
  const byCsvCommodity = new Map(commodities.map((c) => [c.csvCommodity!, c]));

  const raw = await downloadMcsCsv();
  const lines = raw.split(/\r?\n/);
  const header = parseCsvLine(lines[0]);
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const points: MetricPoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const fields = parseCsvLine(line);
    const commodity = byCsvCommodity.get(fields[idx["Commodity"]]);
    if (!commodity) continue;
    if (!fields[idx["Section"]]?.startsWith("World")) continue;

    const detail = fields[idx["Statistics_detail"]];
    const country = fields[idx["Country"]];
    const year = fields[idx["Year"]];
    const unit = fields[idx["Unit"]];
    const value = parseFloat(fields[idx["Value"]].replace(/,/g, ""));
    if (Number.isNaN(value) || !year) continue;

    if (country === "World total" && detail.startsWith(commodity.csvDetail!) && /rounded/i.test(detail)) {
      points.push({
        metric_key: `commodity.${commodity.slug}.production`,
        observed_at: `${year}-12-31`,
        value,
        unit,
        source_key: "usgs_mcs",
        source_tier: 1,
        frequency: "annual",
      });
      continue;
    }

    if (detail === commodity.csvDetail) {
      const countryDef = commodity.countries.find((c) => c.csvCountryName === country);
      if (!countryDef) continue;
      points.push({
        metric_key: `commodity.${commodity.slug}.country.${countryDef.slug}.production`,
        observed_at: `${year}-12-31`,
        value,
        unit,
        source_key: "usgs_mcs",
        source_tier: 1,
        frequency: "annual",
      });
    }
  }
  return points;
}

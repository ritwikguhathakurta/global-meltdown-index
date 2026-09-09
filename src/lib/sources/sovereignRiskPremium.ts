import type { MetricPoint } from "../metrics/store";
import { EM_DEBT_COUNTRIES } from "./worldBankEmDebt";
import { fetchWorkbookSheet } from "./xlsWorkbook";

/**
 * Sovereign CDS is not freely available live — ICE/Markit-licensed, no free feed
 * exists (checked directly). Aswath Damodaran (NYU Stern) publishes a free,
 * no-login "Country Risk Premiums" workbook (ctryprem.xlsx) that includes a
 * "10-year CDS Spreads" sheet with actual observed market CDS levels (not his own
 * synthetic ratings-based estimate — that is a separate column, deliberately not
 * used here since it adds no information beyond the credit rating itself) for
 * countries where a market actually quotes one.
 *
 * Important limitation, disclosed rather than glossed over: this is a single
 * point-in-time annual snapshot (the file is refreshed roughly once a year,
 * dated in its own column header, e.g. "CDS Spread (12/31/25)"), not a daily or
 * even monthly feed. It is used here as one structural/market-priced input to
 * the EM Debt vulnerability score, not as the spec's envisioned high-frequency
 * "CDS acceleration" signal — there is no free source for that. Frequency is
 * tagged "annual" so freshness/lookback windows treat it accordingly.
 *
 * Coverage is real but incomplete: several countries (e.g. Argentina) show "NA"
 * even with a credit rating, because no CDS market maker quotes one. Those are
 * left UNAVAILABLE for that country, never backfilled with the ratings-only
 * synthetic spread.
 */

const DAMODARAN_URL = "https://www.stern.nyu.edu/~adamodar/pc/datasets/ctryprem.xlsx";

// Exact country-name strings as they appear in Damodaran's own sheet — verified
// directly against a live download, not assumed (e.g. "Korea", not "South Korea";
// "Turkey", not "Türkiye").
const SHEET_NAME_TO_COUNTRY_KEY: Record<string, string> = {
  Brazil: "brazil",
  Mexico: "mexico",
  "South Africa": "south_africa",
  Turkey: "turkey",
  India: "india",
  Indonesia: "indonesia",
  China: "china",
  Philippines: "philippines",
  Poland: "poland",
  Hungary: "hungary",
  "Czech Republic": "czech_republic",
  Thailand: "thailand",
  Malaysia: "malaysia",
  Korea: "south_korea",
};

const VALID_COUNTRY_KEYS = new Set(EM_DEBT_COUNTRIES.map((c) => c.key));

export function parseSnapshotDate(header: string): string | null {
  // Header looks like "CDS Spread (12/31/25)" — extract mm/dd/yy(yy).
  const m = header.match(/CDS Spread \((\d{1,2})\/(\d{1,2})\/(\d{2,4})\)/);
  if (!m) return null;
  const [, mm, dd, yyRaw] = m;
  const yyyy = yyRaw.length === 2 ? 2000 + Number(yyRaw) : Number(yyRaw);
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

export async function fetchSovereignRiskPremium(): Promise<MetricPoint[]> {
  const rows = await fetchWorkbookSheet(DAMODARAN_URL, "10-year CDS Spreads");
  const header = rows[0] as string[];
  const cdsColIndex = header.findIndex((h) => typeof h === "string" && h.startsWith("CDS Spread ("));
  if (cdsColIndex === -1) throw new Error("Damodaran ctryprem.xlsx: CDS Spread column not found (header format may have changed)");
  const observedAt = parseSnapshotDate(header[cdsColIndex]);
  if (!observedAt) throw new Error(`Damodaran ctryprem.xlsx: could not parse snapshot date from header "${header[cdsColIndex]}"`);

  const points: MetricPoint[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as (string | number)[];
    const countryName = String(row[0] ?? "").trim();
    const countryKey = SHEET_NAME_TO_COUNTRY_KEY[countryName];
    if (!countryKey || !VALID_COUNTRY_KEYS.has(countryKey)) continue;
    const raw = row[cdsColIndex];
    if (typeof raw !== "number") continue; // "NA" or blank — no quoted CDS for this country

    points.push({
      metric_key: `emdebt.${countryKey}.sovereign_cds_10y`,
      observed_at: observedAt,
      value: Math.round(raw * 10000 * 100) / 100, // stored as decimal (0.0299) -> bps (299)
      unit: "bps",
      source_key: "damodaran_nyu",
      source_tier: 2,
      frequency: "annual",
      raw: { source_file: "ctryprem.xlsx", sheet: "10-year CDS Spreads" },
    });
  }
  return points;
}

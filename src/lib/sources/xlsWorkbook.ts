import * as XLSX from "xlsx";

/**
 * Shared helper for the two free data sources that only publish legacy binary
 * .xls workbooks (NY Fed GSCPI, Caldara-Iacoviello GPR index) — both are
 * OLE2/BIFF files regardless of the URL's apparent extension, so a real
 * spreadsheet parser is required rather than a CSV split.
 */
export async function fetchWorkbookSheet(url: string, sheetName?: string): Promise<unknown[][]> {
  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`workbook fetch ${url}: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheet = wb.Sheets[sheetName ?? wb.SheetNames[0]];
  if (!sheet) throw new Error(`workbook ${url}: sheet "${sheetName}" not found (have: ${wb.SheetNames.join(", ")})`);
  return XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
}

/** Excel's 1900-date-system serial number -> ISO date (accurate for all post-1901 dates). */
export function excelSerialToIso(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

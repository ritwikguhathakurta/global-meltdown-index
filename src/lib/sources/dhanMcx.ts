import type { MetricPoint } from "../metrics/store";
import { fetchRetry } from "./fetchRetry";

/**
 * MCX (Multi Commodity Exchange of India) real-time futures quotes via the DhanHQ market-data
 * API — the licensed route to MCX data: MCX's own site and feeds are bot-blocked/licensed, but
 * Dhan (a SEBI-registered broker) redistributes real-time MCX quotes to its account holders.
 *
 *   POST https://api.dhan.co/v2/marketfeed/quote
 *   headers: access-token, client-id     body: {"MCX_COMM": [<securityId>, ...]}
 *
 * Contract selection uses Dhan's public instrument master
 * (https://images.dhan.co/api-data/api-scrip-master.csv): the nearest unexpired FUTCOM contract
 * per underlying below.
 *
 * NOT VERIFIED END-TO-END: written from Dhan's published API shape without live credentials in
 * this environment. Until DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN are set the stage reports a
 * "not configured" warning and writes nothing; the first configured run is the real test, and
 * response-shape mismatches surface as an explicit error rather than a guessed value. Dhan
 * access tokens expire (24h by default), so a stale token also surfaces as an explicit HTTP
 * error. Tier 3: a broker relay of exchange data, labeled as such wherever shown.
 */
const QUOTE_URL = "https://api.dhan.co/v2/marketfeed/quote";
const MASTER_URL = "https://images.dhan.co/api-data/api-scrip-master.csv";

const UNDERLYINGS = [
  { name: "GOLD", slug: "gold" },
  { name: "SILVER", slug: "silver" },
  { name: "CRUDEOIL", slug: "crudeoil" },
  { name: "NATURALGAS", slug: "naturalgas" },
  { name: "COPPER", slug: "copper" },
  { name: "ALUMINIUM", slug: "aluminium" },
  { name: "ZINC", slug: "zinc" },
];

type Contract = { securityId: string; slug: string; expiry: string };

async function nearestContracts(): Promise<Contract[]> {
  const res = await fetchRetry(MASTER_URL, { next: { revalidate: 0 } });
  if (!res.ok) throw new Error(`Dhan instrument master: HTTP ${res.status}`);
  const lines = (await res.text()).split("\n");
  const header = lines[0].split(",");
  const iExch = header.indexOf("SEM_EXM_EXCH_ID");
  const iId = header.indexOf("SEM_SMST_SECURITY_ID");
  const iInstr = header.indexOf("SEM_INSTRUMENT_NAME");
  const iExpiry = header.indexOf("SEM_EXPIRY_DATE");
  const iName = header.indexOf("SM_SYMBOL_NAME");
  const today = new Date().toISOString().slice(0, 10);
  const best = new Map<string, Contract>();
  for (const line of lines.slice(1)) {
    const f = line.split(",");
    if (f[iExch] !== "MCX" || f[iInstr] !== "FUTCOM") continue;
    const u = UNDERLYINGS.find((x) => x.name === f[iName]?.trim());
    const expiry = f[iExpiry]?.slice(0, 10);
    if (!u || !expiry || expiry < today) continue;
    const cur = best.get(u.slug);
    if (!cur || expiry < cur.expiry) best.set(u.slug, { securityId: f[iId], slug: u.slug, expiry });
  }
  return [...best.values()];
}

type Quote = { last_price?: number; oi?: number; volume?: number };

export async function fetchDhanMcx(clientId: string, accessToken: string): Promise<MetricPoint[]> {
  const contracts = await nearestContracts();
  if (contracts.length === 0) throw new Error("Dhan MCX: no unexpired futures found in the instrument master");
  const res = await fetchRetry(QUOTE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "access-token": accessToken, "client-id": clientId },
    body: JSON.stringify({ MCX_COMM: contracts.map((c) => Number(c.securityId)) }),
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error(`Dhan MCX quote: HTTP ${res.status}`);
  const body = (await res.json()) as { data?: { MCX_COMM?: Record<string, Quote> }; status?: string };
  const quotes = body.data?.MCX_COMM;
  if (!quotes) throw new Error(`Dhan MCX quote: unexpected response shape (status=${body.status ?? "?"})`);

  const observed_at = new Date().toISOString().slice(0, 10);
  const base = { observed_at, source_key: "dhan_mcx", source_tier: 3 as const, frequency: "daily" as const };
  const points: MetricPoint[] = [];
  for (const c of contracts) {
    const q = quotes[c.securityId];
    if (!q) continue;
    if (Number.isFinite(q.last_price) && (q.last_price as number) > 0) points.push({ ...base, metric_key: `derivatives.mcx.${c.slug}.last`, value: q.last_price as number, unit: "INR" });
    if (Number.isFinite(q.oi) && (q.oi as number) > 0) points.push({ ...base, metric_key: `derivatives.mcx.${c.slug}.oi`, value: q.oi as number, unit: "contracts" });
    if (Number.isFinite(q.volume)) points.push({ ...base, metric_key: `derivatives.mcx.${c.slug}.volume`, value: q.volume as number, unit: "contracts" });
  }
  if (points.length === 0) throw new Error("Dhan MCX quote: no usable quotes for the selected contracts");
  return points;
}

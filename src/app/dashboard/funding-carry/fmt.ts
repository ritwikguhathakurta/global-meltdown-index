import { BP, isNum } from "@/lib/carry/units";
import { benchmarkName } from "@/lib/carry/currencies";

export const pct = (x: number | null | undefined, dp = 2) => (isNum(x) ? `${(x * 100).toFixed(dp)}%` : "—");
export const bpS = (x: number | null | undefined, dp = 0) => (isNum(x) ? `${x / BP > 0 ? "+" : ""}${(x / BP).toFixed(dp)} bp` : "—");
export const bpU = (x: number | null | undefined, dp = 0) => (isNum(x) ? `${(x / BP).toFixed(dp)} bp` : "—");
export const cr = (inr: number | null | undefined, dp = 2) => (isNum(inr) ? `₹${(inr / 1e7).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })} Cr` : "—");
export const spreadText = (ccy: string, spread: number | null | undefined) => (isNum(spread) ? `${benchmarkName(ccy)} + ${(spread / BP).toFixed(0)} bp` : "—");

export const STATUS_HELP: Record<string, string> = {
  EXECUTE: "Every gate passes on firm, fresh dealer quotes: this is a candidate to take to the banks. Nothing is executed by this app.",
  WATCH: "Looks positive but at least one gate fails (usually: quotes not firm / stale, or the saving is below your minimum).",
  AVOID: "Costs more than your rupee alternative after bid/offer, or it is blocked by regulation, liquidity or your risk limits.",
  INSUFFICIENT_DATA: "One or more quotes are missing: the app will not guess them.",
  MODEL_VALIDATION_FAILED: "An internal consistency check failed: no signal is generated until it is fixed.",
};

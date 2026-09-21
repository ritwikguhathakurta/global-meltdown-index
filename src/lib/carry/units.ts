export const BP = 0.0001;
export const CRORE = 1e7;

export const fromBp = (bp: number): number => bp * BP;
export const toBp = (d: number): number => d / BP;
export const crToInr = (cr: number): number => cr * CRORE;
export const inrToCr = (inr: number): number => inr / CRORE;

export function isNum(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x);
}

export class ModelError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

/** Never let NaN / Infinity propagate into output. */
export function fin(x: number, label: string): number {
  if (!Number.isFinite(x)) throw new ModelError("NON_FINITE", `${label} is not a finite number`);
  return x;
}

export function fmtPct(d: number | null | undefined, dp = 2): string {
  return isNum(d) ? `${(d * 100).toFixed(dp)}%` : "—";
}

export function fmtBp(d: number | null | undefined, dp = 0, signed = true): string {
  if (!isNum(d)) return "—";
  const v = toBp(d);
  const s = v.toFixed(dp);
  return `${signed && v > 0 ? "+" : ""}${s} bp`;
}

export function fmtNum(x: number | null | undefined, dp = 2): string {
  if (!isNum(x)) return "—";
  return x.toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtCr(inr: number | null | undefined, dp = 2): string {
  if (!isNum(inr)) return "—";
  return `₹${(inr / CRORE).toLocaleString("en-IN", { minimumFractionDigits: dp, maximumFractionDigits: dp })} Cr`;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

/** Bisection root finder on a bracket; returns null when no sign change. */
export function bisect(f: (x: number) => number, lo: number, hi: number, tol = 1e-12, maxIter = 200): number | null {
  let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi)) return null;
  if (flo === 0) return lo;
  if (fhi === 0) return hi;
  if (flo * fhi > 0) return null;
  let a = lo;
  let b = hi;
  for (let i = 0; i < maxIter; i++) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (!Number.isFinite(fm)) return null;
    if (Math.abs(fm) < tol || (b - a) / 2 < tol) return m;
    if (flo * fm < 0) b = m;
    else {
      a = m;
      flo = fm;
    }
  }
  return (a + b) / 2;
}

/** Standard normal pdf / inverse cdf (Acklam) for parametric VaR. */
export function normPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

export function normInv(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const pl = 0.02425;
  if (p <= 0 || p >= 1) throw new ModelError("BAD_PROB", "probability must be in (0,1)");
  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p > 1 - pl) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = p - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

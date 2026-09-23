import assert from "node:assert/strict";
import { computePci, buildPositioningRow, CROWDED_Z, type PositioningMarketDef } from "../positioning";
import { computeGli, computeCri } from "../leverage";
import { computeMsi, computeCsi, computeFdrAndDls, computeCalciAndRegime } from "../stress";
import { runScenario } from "../scenario";
import { HISTORICAL_CRISES } from "../historical";
import type { Point } from "../../metrics/stats";

let failed = 0;
let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL ${name}\n       ${(e as Error).message}`);
  }
}

function flatSeries(value: number, weeks: number): Point[] {
  const points: Point[] = [];
  const start = new Date("2024-01-01T00:00:00Z");
  for (let i = 0; i < weeks; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * 7);
    points.push({ t: d.toISOString().slice(0, 10), v: value });
  }
  return points;
}

function extremeSeries(weeks: number, extremeValue: number): Point[] {
  const points = flatSeries(0, weeks - 1);
  const last = new Date(points[points.length - 1].t);
  last.setUTCDate(last.getUTCDate() + 7);
  points.push({ t: last.toISOString().slice(0, 10), v: extremeValue });
  return points;
}

test("buildPositioningRow: flags crowded when |z| >= threshold", () => {
  const series = extremeSeries(104, 80); // long flat history then one extreme reading
  const row = buildPositioningRow({ market: "test", category: "test", metricKey: "x" }, series);
  assert.ok(row.crowded, "expected an extreme reading to be flagged crowded");
  assert.ok(row.extremityZ !== null && Math.abs(row.extremityZ) >= CROWDED_Z);
});

test("buildPositioningRow: not crowded on flat series", () => {
  const series = flatSeries(5, 104);
  const row = buildPositioningRow({ market: "test", category: "test", metricKey: "x" }, series);
  assert.equal(row.crowded, false);
});

test("computePci: UNAVAILABLE when no series have data", () => {
  const defs: PositioningMarketDef[] = [{ market: "a", category: "b", metricKey: "missing" }];
  const pci = computePci(defs, new Map());
  assert.equal(pci.quality, "UNAVAILABLE");
  assert.equal(pci.level, null);
});

test("computePci: level is 0-100 and reflects crowding share", () => {
  const defs: PositioningMarketDef[] = [
    { market: "a", category: "x", metricKey: "k1" },
    { market: "b", category: "x", metricKey: "k2" },
  ];
  const seriesByKey = new Map<string, Point[]>([
    ["k1", extremeSeries(104, 90)],
    ["k2", flatSeries(1, 104)],
  ]);
  const pci = computePci(defs, seriesByKey);
  assert.equal(pci.quality, "REAL");
  assert.ok(pci.level !== null && pci.level >= 0 && pci.level <= 100);
});

test("computeGli: UNAVAILABLE with no inputs", () => {
  const gli = computeGli({ otcNotionalTotal: [], creditGapSeries: [], bankLeverageRatios: [], repoVolume: [] });
  assert.equal(gli.quality, "UNAVAILABLE");
});

test("computeGli: higher OTC notional growth raises the level", () => {
  const yearAgoAndNowFlat: Point[] = [{ t: "2024-01-01", v: 100 }, { t: "2025-01-01", v: 100 }];
  const yearAgoAndNowRising: Point[] = [{ t: "2024-01-01", v: 100 }, { t: "2025-01-01", v: 130 }];
  const gliFlat = computeGli({ otcNotionalTotal: yearAgoAndNowFlat, creditGapSeries: [], bankLeverageRatios: [], repoVolume: [] });
  const gliRising = computeGli({ otcNotionalTotal: yearAgoAndNowRising, creditGapSeries: [], bankLeverageRatios: [], repoVolume: [] });
  assert.ok(gliRising.level !== null && gliFlat.level !== null && gliRising.level > gliFlat.level);
});

test("computeCri: MODEL_ESTIMATE quality with credit spread input", () => {
  const cri = computeCri({ bankLeverageRatios: [{ bank: "x", ratio: 8 }], creditSpreadZ: 1.5 });
  assert.equal(cri.quality, "MODEL_ESTIMATE");
  assert.ok(cri.level !== null && cri.level > 50);
});

test("computeMsi/computeCsi: UNAVAILABLE with no data", () => {
  const msi = computeMsi({ vix: [], move: [], positioningLevel: null });
  const csi = computeCsi({ repoDispersion: [], repoVolumeChange: null });
  assert.equal(msi.quality, "UNAVAILABLE");
  assert.equal(csi.quality, "UNAVAILABLE");
});

test("computeMsi: MODEL_ESTIMATE and every reading carries provenance", () => {
  const msi = computeMsi({ vix: extremeSeries(252, 60), move: flatSeries(80, 252), positioningLevel: 40 });
  assert.equal(msi.quality, "MODEL_ESTIMATE");
  for (const r of msi.inputs) assert.ok(r.quality === "REAL" || r.quality === "UNAVAILABLE");
});

test("computeFdrAndDls: derives from msi/csi/pci without inventing new real data", () => {
  const msi = computeMsi({ vix: extremeSeries(252, 60), move: flatSeries(80, 252), positioningLevel: 40 });
  const csi = computeCsi({ repoDispersion: extremeSeries(252, 2), repoVolumeChange: 5 });
  const pci = computePci([{ market: "a", category: "x", metricKey: "k1" }], new Map([["k1", extremeSeries(104, 90)]]));
  const { fdr, dls } = computeFdrAndDls(msi, csi, pci);
  assert.equal(fdr.quality, "MODEL_ESTIMATE");
  assert.equal(dls.quality, "MODEL_ESTIMATE");
  assert.ok(fdr.level !== null && fdr.level >= 0 && fdr.level <= 100);
});

test("computeCalciAndRegime: amplifies leverage when stress is also elevated", () => {
  const gli = computeGli({ otcNotionalTotal: [...flatSeries(100, 4), { t: "2025-01-01", v: 130 }], creditGapSeries: [], bankLeverageRatios: [], repoVolume: [] });
  const lowStressMsi = computeMsi({ vix: flatSeries(15, 252), move: flatSeries(70, 252), positioningLevel: 10 });
  const lowStressCsi = computeCsi({ repoDispersion: flatSeries(0.1, 252), repoVolumeChange: 0 });
  const highStressMsi = computeMsi({ vix: extremeSeries(252, 90), move: extremeSeries(252, 200), positioningLevel: 80 });
  const highStressCsi = computeCsi({ repoDispersion: extremeSeries(252, 5), repoVolumeChange: 30 });
  const pci = computePci([], new Map());

  const { calci: calciLow } = computeCalciAndRegime(gli, lowStressMsi, lowStressCsi, pci);
  const { calci: calciHigh } = computeCalciAndRegime(gli, highStressMsi, highStressCsi, pci);
  assert.ok(calciLow.level !== null && calciHigh.level !== null);
  assert.ok(calciHigh.level > calciLow.level, `expected higher stress to amplify CALCI: ${calciLow.level} vs ${calciHigh.level}`);
});

test("runScenario: larger shocks produce larger deltas, never negative", () => {
  const current = { msi: computeMsi({ vix: flatSeries(15, 252), move: flatSeries(70, 252), positioningLevel: 10 }), csi: computeCsi({ repoDispersion: flatSeries(0.1, 252), repoVolumeChange: 0 }), pci: computePci([], new Map()) };
  const small = runScenario({ equityPct: -5, ratesBp: 25, usdPct: 0, vixPct: 20 }, current);
  const large = runScenario({ equityPct: -20, ratesBp: 100, usdPct: 0, vixPct: 80 }, current);
  assert.ok(large.msiLevelDelta > small.msiLevelDelta);
  assert.ok(large.csiLevelDelta > small.csiLevelDelta);
  assert.ok(small.msiLevelDelta >= 0 && small.csiLevelDelta >= 0);
});

test("HISTORICAL_CRISES: every entry has a year, mechanism and at least one relevant index", () => {
  assert.ok(HISTORICAL_CRISES.length >= 5);
  for (const e of HISTORICAL_CRISES) {
    assert.ok(e.year.length > 0);
    assert.ok(e.mechanism.length > 20);
    assert.ok(e.relevantIndices.length > 0);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

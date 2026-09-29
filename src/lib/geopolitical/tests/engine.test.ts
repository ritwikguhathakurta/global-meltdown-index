import assert from "node:assert/strict";
import { buildCountryMilitaryRows, computeMilitaryBuildup } from "../military";
import { computeSanctionsIntensity } from "../sanctions";
import { computeEscalation } from "../escalation";
import { buildChokepointRows, computeChokepointStress } from "../chokepoints";
import { computeGewi } from "../gewi";
import { HISTORICAL_GEO_EVENTS } from "../historical";
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

function series(values: number[], startIso = "2020-01-01", stepDays = 30): Point[] {
  const points: Point[] = [];
  const start = new Date(`${startIso}T00:00:00Z`);
  for (let i = 0; i < values.length; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i * stepDays);
    points.push({ t: d.toISOString().slice(0, 10), v: values[i] });
  }
  return points;
}

test("computeMilitaryBuildup: UNAVAILABLE with no YoY-eligible rows", () => {
  const rows = buildCountryMilitaryRows({ countries: [{ slug: "x", label: "X" }], spendPctGdpByCountry: {}, spendUsdByCountry: {} });
  const idx = computeMilitaryBuildup(rows);
  assert.equal(idx.quality, "UNAVAILABLE");
  assert.equal(idx.level, null);
});

test("computeMilitaryBuildup: rising spend growth pushes level above 50", () => {
  const usdSeries = series([100, 100, 130], "2022-01-01", 365);
  const rows = buildCountryMilitaryRows({ countries: [{ slug: "x", label: "X" }], spendPctGdpByCountry: {}, spendUsdByCountry: { x: usdSeries } });
  const idx = computeMilitaryBuildup(rows);
  assert.equal(idx.quality, "REAL");
  assert.ok(idx.level !== null && idx.level > 50, `expected level > 50 for rising spend, got ${idx.level}`);
});

test("computeSanctionsIntensity: REAL-but-no-trend when history is too short", () => {
  const idx = computeSanctionsIntensity({ russia: series([100, 105, 110]) });
  assert.equal(idx.quality, "REAL");
  assert.equal(idx.level, null);
  assert.equal(idx.inputs.length, 1);
});

test("computeSanctionsIntensity: UNAVAILABLE with no data at all", () => {
  const idx = computeSanctionsIntensity({});
  assert.equal(idx.quality, "UNAVAILABLE");
});

test("computeEscalation: a sustained Goldstein decline raises the level", () => {
  const flat = series(Array(30).fill(2), "2023-01-01", 3);
  const declining = [...Array(29).fill(2), -6];
  const idx = computeEscalation({ avgGoldstein: series(declining, "2023-01-01", 3), conflictShare: flat, gprThreats: [] });
  assert.equal(idx.quality, "REAL");
  assert.ok(idx.level !== null && idx.level > 50, `expected escalation level > 50 on a Goldstein decline, got ${idx.level}`);
});

test("computeChokepointStress: a transit drop registers as stress (level > 50)", () => {
  const flat = Array(89).fill(50);
  const dropped = series([...flat, 20], "2023-01-01", 1);
  const rows = buildChokepointRows({ chokepoints: [{ slug: "suez", label: "Suez" }], transitsBySlug: { suez: dropped } });
  const idx = computeChokepointStress(rows);
  assert.equal(idx.quality, "REAL");
  assert.ok(idx.level !== null && idx.level > 50, `expected stress level > 50 on a transit drop, got ${idx.level}`);
});

test("computeGewi: UNAVAILABLE when every component is UNAVAILABLE", () => {
  const unavailable = { key: "x", label: "X", level: null, change4w: null, quality: "UNAVAILABLE" as const, methodology: "none", inputs: [] };
  const idx = computeGewi([unavailable, unavailable]);
  assert.equal(idx.quality, "UNAVAILABLE");
});

test("computeGewi: MODEL_ESTIMATE averaging available components", () => {
  const a = { key: "a", label: "A", level: 80, change4w: null, quality: "REAL" as const, methodology: "m", inputs: [] };
  const b = { key: "b", label: "B", level: 40, change4w: null, quality: "REAL" as const, methodology: "m", inputs: [] };
  const idx = computeGewi([a, b]);
  assert.equal(idx.quality, "MODEL_ESTIMATE");
  assert.equal(idx.level, 60);
});

test("HISTORICAL_GEO_EVENTS: every entry has a year, mechanism and at least one relevant index", () => {
  assert.ok(HISTORICAL_GEO_EVENTS.length >= 5);
  for (const e of HISTORICAL_GEO_EVENTS) {
    assert.ok(e.year.length > 0);
    assert.ok(e.mechanism.length > 20);
    assert.ok(e.relevantIndices.length > 0);
  }
});

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

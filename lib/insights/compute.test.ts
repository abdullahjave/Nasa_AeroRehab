import test from "node:test";
import assert from "node:assert/strict";
import { compare, dataGaps, dedupeById, isComparableBaseline, meetsReducedRom, overlayRows, peakRepetition } from "./compute";
import { REDUCED_ROM_DEMO } from "./config";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const v = <T,>(m: { kind: string; value?: T }): T => {
  assert.equal(m.kind, "value");
  return m.value as T;
};

test("hand-checked: peak flexion 118 vs 124 and ROM 107 vs 114", () => {
  const peak = compare(118, 124, true);
  near(v<number>(peak.diff), -6);
  near(v<number>(peak.pct), (-6 / 124) * 100);
  near(v<number>(peak.pct), -4.84, 0.005);
  const rom = compare(107, 114, true);
  near(v<number>(rom.diff), -7);
  near(v<number>(rom.pct), (-7 / 114) * 100);
  near(v<number>(rom.pct), -6.14, 0.005);
  assert.equal(meetsReducedRom(rom, REDUCED_ROM_DEMO), true);
});

test("mismatched baseline: current is still shown, comparison is unavailable", () => {
  const ctx = { side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion" };
  assert.equal(isComparableBaseline(ctx, { ...ctx, side: "right" }), false);
  assert.equal(isComparableBaseline(ctx, { ...ctx, protocol: "loaded-knee-flexion" }), false);
  assert.equal(isComparableBaseline(ctx, { ...ctx, movement: "other" }), false);
  assert.equal(isComparableBaseline(ctx, null), false);
  assert.equal(isComparableBaseline(ctx, { ...ctx }), true);
  const c = compare(118, 124, false);
  assert.equal(v<number>(c.current), 118);
  assert.deepEqual(c.baseline, { kind: "unavailable", reason: "no-comparable-baseline" });
  assert.deepEqual(c.diff, { kind: "unavailable", reason: "no-comparable-baseline" });
  assert.deepEqual(c.pct, { kind: "unavailable", reason: "no-comparable-baseline" });
  assert.equal(meetsReducedRom(c, REDUCED_ROM_DEMO), false);
});

test("zero baseline: signed difference exists, percent change does not", () => {
  const c = compare(10, 0, true);
  assert.equal(v<number>(c.diff), 10);
  assert.deepEqual(c.pct, { kind: "unavailable", reason: "invalid-baseline" });
  assert.deepEqual(compare(10, -4, true).pct, { kind: "unavailable", reason: "invalid-baseline" });
  assert.deepEqual(compare(10, Number.NaN, true).baseline, { kind: "unavailable", reason: "invalid-baseline" });
});

test("missing measurement stays unavailable", () => {
  const c = compare(null, 124, true);
  assert.deepEqual(c.current, { kind: "unavailable", reason: "missing-measurement" });
  assert.equal(v<number>(c.baseline), 124);
  assert.deepEqual(c.diff, { kind: "unavailable", reason: "missing-measurement" });
  assert.deepEqual(compare(Number.NaN, 124, true).current, { kind: "unavailable", reason: "missing-measurement" });
});

test("exact boundary of the demo threshold is inclusive", () => {
  assert.equal(REDUCED_ROM_DEMO.thresholdPct, -5);
  assert.equal(meetsReducedRom(compare(95, 100, true), REDUCED_ROM_DEMO), true); // exactly -5 %
  assert.equal(meetsReducedRom(compare(95.001, 100, true), REDUCED_ROM_DEMO), false); // -4.999 %
  assert.equal(meetsReducedRom(compare(94.999, 100, true), REDUCED_ROM_DEMO), true);
});

test("no events and unique ids", () => {
  assert.deepEqual(dataGaps([{ t: 0, flexionDeg: 1 }, { t: 2, flexionDeg: 2 }]), []);
  assert.deepEqual(dedupeById([]), []);
  const d = dedupeById([{ id: "a", n: 1 }, { id: "b", n: 2 }, { id: "a", n: 3 }]);
  assert.deepEqual(d.map((x) => x.n), [1, 2]);
  const gaps = dataGaps([{ t: 0, flexionDeg: 1 }, { t: 2, flexionDeg: null }, { t: 4, flexionDeg: null }, { t: 6, flexionDeg: 3 }, { t: 8, flexionDeg: null }]);
  assert.deepEqual(gaps, [{ startIdx: 1, fromSec: 2, toSec: 4 }, { startIdx: 4, fromSec: 8, toSec: 8 }]);
});

test("peak repetition is normalised to cycle percent and keeps the exact peak sample", () => {
  // two reps of 4 intervals each: minima at t = 0, 8, 16
  const deg = [0, 50, 100, 50, 0, 60, 120, 60, 0];
  const samples = deg.map((d, i) => ({ t: i * 2, flexionDeg: d }));
  const r = v<{ points: { pct: number; deg: number }[]; peak: { pct: number; deg: number }; startSec: number; endSec: number }>(peakRepetition(samples));
  assert.equal(r.startSec, 8);
  assert.equal(r.endSec, 16);
  assert.deepEqual(r.peak, { pct: 50, deg: 120 });
  assert.deepEqual(r.points.map((p) => p.pct), [0, 25, 50, 75, 100]);
  // a missing sample inside the peak repetition -> unavailable
  const gap = samples.map((s, i) => (i === 7 ? { ...s, flexionDeg: null } : s));
  assert.deepEqual(peakRepetition(gap), { kind: "unavailable", reason: "no-repetition" });
  // overlay fills a series only where it has a sample
  const rows = overlayRows(r, { ...r, points: [{ pct: 0, deg: 1 }, { pct: 50, deg: 2 }] });
  assert.deepEqual(rows.find((x) => x.pct === 25), { pct: 25, current: 60, baseline: null });
  assert.deepEqual(rows.find((x) => x.pct === 50), { pct: 50, current: 120, baseline: 2 });
});

import test from "node:test";
import assert from "node:assert/strict";
import { CHI2_95_2D, pathAndTime, percentChange, summarizeTrial, swayEllipse } from "./compute";
import type { BalanceSample } from "./types";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const ok = (t: number, x: number, y: number): BalanceSample => ({ timestampMs: t, mlMm: x, apMm: y, status: "ok" });
const miss = (t: number): BalanceSample => ({ timestampMs: t, mlMm: null, apMm: null, status: "missing" });
const v = <T,>(m: { kind: string; value?: T }): T => {
  assert.equal(m.kind, "value");
  return m.value as T;
};

test("hand-checked square: path 8 mm, RMS 1/2 mm, resultant sqrt(5), ellipse pi*5.991*8/3", () => {
  const s = [ok(0, -1, -2), ok(100, 1, -2), ok(200, 1, 2), ok(300, -1, 2)];
  const r = summarizeTrial(s, 10);
  near(v<number>(r.pathLengthMm), 8);
  near(v<number>(r.rmsMlMm), 1);
  near(v<number>(r.rmsApMm), 2);
  near(v<number>(r.rmsResultantMm), Math.sqrt(5));
  const e = v<{ areaMm2: number; cx: number; cy: number; a: number; b: number; angleRad: number }>(r.ellipse);
  near(e.areaMm2, Math.PI * CHI2_95_2D * (8 / 3), 1e-9);
  near(e.areaMm2, 50.19, 0.01);
  near(e.cx, 0);
  near(e.cy, 0);
  // var_ML = 4/3, var_AP = 16/3, cov = 0 -> major axis along AP
  near(e.a, Math.sqrt(CHI2_95_2D * 16 / 3));
  near(e.b, Math.sqrt(CHI2_95_2D * 4 / 3));
  near(Math.abs(e.angleRad), Math.PI / 2);
  near(Math.PI * e.a * e.b, e.areaMm2, 1e-9);
  near(v<number>(r.meanSpeedMmPerS), 8 / 0.3, 1e-9);
  assert.equal(r.coverage, 1);
  assert.equal(r.partial, false);
});

test("no samples: everything unavailable", () => {
  const r = summarizeTrial([]);
  assert.deepEqual(r.pathLengthMm, { kind: "unavailable", reason: "no-samples" });
  assert.deepEqual(r.ellipse, { kind: "unavailable", reason: "no-samples" });
  assert.equal(r.coverage, 0);
  const allMissing = summarizeTrial([miss(0), miss(40)]);
  assert.deepEqual(allMissing.rmsMlMm, { kind: "unavailable", reason: "no-samples" });
});

test("stationary data is a measured zero: path 0, RMS 0, ellipse degenerate", () => {
  const r = summarizeTrial([ok(0, 2, 3), ok(40, 2, 3), ok(80, 2, 3), ok(120, 2, 3)], 25);
  assert.equal(v<number>(r.pathLengthMm), 0);
  assert.equal(v<number>(r.rmsMlMm), 0);
  assert.equal(v<number>(r.rmsApMm), 0);
  assert.equal(v<number>(r.rmsResultantMm), 0);
  assert.deepEqual(r.ellipse, { kind: "unavailable", reason: "degenerate" });
});

test("degenerate ellipse: collinear points", () => {
  assert.deepEqual(swayEllipse([0, 1, 2, 3], [0, 2, 4, 6]), { kind: "unavailable", reason: "degenerate" });
  assert.deepEqual(swayEllipse([0, 1], [0, 1]), { kind: "unavailable", reason: "too-few-points" });
});

test("missing interval: distance is not added across the gap; coverage is partial", () => {
  const s = [ok(0, 0, 0), ok(100, 3, 4), miss(200), ok(300, 30, 40), ok(400, 30, 41), ok(500, 31, 41), ok(600, 31, 42), ok(700, 32, 42), ok(800, 32, 43), ok(900, 33, 43)];
  const { lengthMm, observedS } = pathAndTime(s, 100);
  near(lengthMm, 5 + 6); // (0,0)->(3,4) = 5, then 6 unit steps across the 7 points after the gap; the jump is excluded
  near(observedS, 0.1 + 0.6);
  const r = summarizeTrial(s, 10);
  near(r.coverage, 0.9);
  assert.equal(r.partial, true);
  near(v<number>(r.pathLengthMm), 11);
  // a time jump without an explicit missing slot also breaks the path
  near(pathAndTime([ok(0, 0, 0), ok(100, 1, 0), ok(500, 9, 0), ok(600, 10, 0)], 100).lengthMm, 2);
});

test("low coverage and invalid input make summaries unavailable", () => {
  const low = summarizeTrial([ok(0, 0, 0), miss(40), miss(80), miss(120), ok(160, 1, 1)], 25);
  assert.deepEqual(low.rmsMlMm, { kind: "unavailable", reason: "insufficient-coverage" });
  const nonFinite = summarizeTrial([ok(0, 0, 0), ok(40, Number.NaN, 1), ok(80, 1, 1)], 25);
  assert.deepEqual(nonFinite.ellipse, { kind: "unavailable", reason: "invalid-input" });
  const backwards = summarizeTrial([ok(0, 0, 0), ok(40, 1, 0), ok(40, 1, 1), ok(80, 0, 1)], 25);
  assert.deepEqual(backwards.pathLengthMm, { kind: "unavailable", reason: "invalid-input" });
  assert.ok(backwards.issues.some((i) => i.includes("does not increase")));
});

test("baseline change: absent or zero baseline is unavailable", () => {
  const cur = { kind: "value" as const, value: 40 };
  near(v<number>(percentChange(cur, { kind: "value", value: 50 })), -20);
  assert.deepEqual(percentChange(cur, null), { kind: "unavailable", reason: "no-baseline" });
  assert.deepEqual(percentChange(cur, { kind: "value", value: 0 }), { kind: "unavailable", reason: "no-baseline" });
  assert.deepEqual(percentChange(cur, { kind: "unavailable", reason: "degenerate" }), { kind: "unavailable", reason: "no-baseline" });
  assert.deepEqual(percentChange({ kind: "unavailable", reason: "degenerate" }, { kind: "value", value: 10 }), { kind: "unavailable", reason: "degenerate" });
});

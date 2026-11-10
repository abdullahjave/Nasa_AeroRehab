import test from "node:test";
import assert from "node:assert/strict";
import { inRange, meanOf, metricRow, previousRange, referenceContext, validateRange, type ReportPoint } from "./compute";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const K = { side: "left", protocol: "active-knee-flexion" };
const pt = (day: number, rom: number | null, extra: Partial<ReportPoint> = {}): ReportPoint => ({
  astronautId: "a1", sessionId: `s-${day}`, missionDay: day, knee: K, romDeg: rom, speedMs: null, cadenceSpm: null, balanceIndex: null, ...extra,
});

test("hand-checked: ROM means 115 vs 105, change +10 deg, +9.52 %", () => {
  const cur = [pt(11, 110), pt(12, 120)];
  const prev = [pt(9, 100), pt(10, 110)];
  const r = metricRow("romDeg", cur, prev, K);
  assert.equal(r.current.kind, "value");
  if (r.current.kind === "value") { near(r.current.mean, 115); assert.equal(r.current.n, 2); }
  if (r.previous.kind === "value") near(r.previous.mean, 105);
  near(r.change as number, 10);
  near(r.changePct as number, (10 / 105) * 100);
  near(r.changePct as number, 9.52, 0.005);
});

test("inclusive date boundaries and the preceding same-length range", () => {
  const pts = [pt(9, 1), pt(10, 2), pt(12, 3), pt(13, 4)];
  assert.deepEqual(inRange(pts, "a1", { start: 10, end: 12 }).map((p) => p.missionDay), [10, 12]);
  assert.deepEqual(previousRange({ start: 10, end: 12 }), { start: 7, end: 9 });
  assert.deepEqual(previousRange({ start: 42, end: 42 }), { start: 41, end: 41 });
  assert.deepEqual(validateRange({ start: 12, end: 10 }, 1, 42), { ok: false, message: "The start date is after the end date." });
  assert.equal(validateRange({ start: 0, end: 10 }, 1, 42).ok, false);
  assert.equal(validateRange({ start: 1, end: 42 }, 1, 42).ok, true);
});

test("missing measurements are skipped, not counted as zero", () => {
  const m = meanOf([110, null, Number.NaN, 120]);
  if (m.kind !== "value") throw new Error();
  near(m.mean, 115);
  assert.equal(m.n, 2);
  assert.deepEqual(meanOf([null, null]), { kind: "unavailable", reason: "no-valid-sessions" });
});

test("no comparison period: current value stays, change is unavailable", () => {
  const r = metricRow("romDeg", [pt(5, 100)], [], K);
  assert.equal(r.current.kind, "value");
  assert.deepEqual(r.previous, { kind: "unavailable", reason: "no-valid-sessions" });
  assert.equal(r.change, null);
  assert.equal(r.changePct, null);
  // zero previous mean -> no percent change
  const z = metricRow("speedMs", [pt(5, null, { speedMs: 1 })], [pt(4, null, { speedMs: 0 })], K);
  assert.equal(z.change, 1);
  assert.equal(z.changePct, null);
});

test("mismatched knee side or protocol is excluded, never averaged", () => {
  const cur = [pt(11, 110), pt(12, 120, { knee: { side: "right", protocol: K.protocol } })];
  const prev = [pt(9, 100), pt(10, 50, { knee: { side: "left", protocol: "loaded-knee-flexion" } })];
  const r = metricRow("romDeg", cur, prev, K);
  if (r.current.kind !== "value" || r.previous.kind !== "value") throw new Error();
  near(r.current.mean, 110);
  near(r.previous.mean, 100);
  assert.equal(r.excludedCurrent, 1);
  assert.equal(r.excludedPrevious, 1);
  // non-knee metrics are not filtered by knee context
  const g = metricRow("speedMs", [pt(11, null, { speedMs: 1.2, knee: { side: "right", protocol: "x" } })], [], K);
  assert.equal(g.excludedCurrent, 0);
  assert.deepEqual(referenceContext(cur), { side: "right", protocol: K.protocol });
});

test("astronaut isolation", () => {
  const pts = [pt(10, 100), pt(10, 50, { astronautId: "a2", sessionId: "other" })];
  assert.deepEqual(inRange(pts, "a1", { start: 1, end: 42 }).map((p) => p.sessionId), ["s-10"]);
  assert.deepEqual(inRange(pts, "a3", { start: 1, end: 42 }), []);
});

test("observation rows: no row for days without a session, null for a missing measurement", async () => {
  const { observationRows } = await import("./compute");
  const pts = [pt(13, 100, { speedMs: 1.2 }), pt(15, 102, { speedMs: null }), pt(19, 104, { speedMs: 1.3 }), pt(17, 90, { knee: { side: "left", protocol: "loaded" }, speedMs: 1.25 })];
  const rom = observationRows(pts, "romDeg", K);
  assert.deepEqual(rom.map((r) => [r.day, r.value]), [[13, 100], [15, 102], [19, 104]]); // loaded protocol excluded, no gap row
  const speed = observationRows(pts, "speedMs", K);
  assert.deepEqual(speed.map((r) => [r.day, r.value]), [[13, 1.2], [15, null], [17, 1.25], [19, 1.3]]);
});

test("padded domain wraps the observed values", async () => {
  const { paddedDomain } = await import("./compute");
  const d = paddedDomain([100, 114, null], 5, 10) as [number, number];
  assert.ok(d[0] < 100 && d[1] > 114, JSON.stringify(d));
  assert.equal(d[0] % 5, 0);
  const one = paddedDomain([94], 5, 10, 0, 100) as [number, number];
  assert.ok(one[0] < 94 && one[1] <= 100 && one[1] > 94, JSON.stringify(one));
  assert.equal(paddedDomain([null], 5, 10), null);
});

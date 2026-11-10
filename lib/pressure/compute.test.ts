// Run with: npm test   (scripts/run-tests.mjs transpiles lib/**/*.ts and runs node:test)
import test from "node:test";
import assert from "node:assert/strict";
import { analyzeFoot, analyzeFrame, analyzeSession, copPath, sensorForceN, validateSample } from "./compute";
import type { FootSide, PressureFrame, PressureSample } from "./types";

const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

function s(id: string, side: FootSide, kpa: number | null, area: number, x: number, y: number, t = 0, status: "ok" | "missing" = "ok"): PressureSample {
  return { timestampMs: t, sensorId: id, side, pressureKpa: kpa, areaCm2: area, positionMm: { x, y }, status };
}

/** Hand-checked fixture from the spec. */
const fixture = (t = 0): PressureFrame => ({
  timestampMs: t,
  samples: [
    s("L-A", "left", 100, 2, 0, 0, t),
    s("L-B", "left", 50, 4, 40, 0, t),
    s("R-A", "right", 150, 4, 60, 10, t),
  ],
});

const val = <T,>(m: { kind: string } & Partial<{ value: T }>): T => {
  assert.equal(m.kind, "value");
  return m.value as T;
};

test("force formula: kPa * cm^2 * 0.1 = N", () => {
  near(sensorForceN(100, 2), 20);
  near(sensorForceN(0, 5), 0);
});

test("hand-checked fixture", () => {
  const f = analyzeFrame(fixture());
  near(val<number>(f.left.forceN), 40);
  near(val<number>(f.right.forceN), 60);
  const sh = val<{ leftPct: number; rightPct: number }>(f.shares);
  near(sh.leftPct, 40);
  near(sh.rightPct, 60);
  near(val<number>(f.differencePp), 20);
  near(val<number>(f.peakKpa), 150);
  const lc = val<{ x: number; y: number }>(f.left.copMm);
  near(lc.x, 20);
  near(lc.y, 0);
  const rc = val<{ x: number; y: number }>(f.right.copMm);
  near(rc.x, 60);
  near(rc.y, 10);
});

test("zero load is measured, not unavailable; share and CoP are undefined", () => {
  const f = analyzeFrame({
    timestampMs: 0,
    samples: [s("L-A", "left", 0, 2, 0, 0), s("L-B", "left", 0, 4, 40, 0), s("R-A", "right", 0, 4, 60, 10)],
  });
  assert.equal(val<number>(f.left.forceN), 0);
  assert.equal(val<number>(f.right.forceN), 0);
  assert.equal(val<number>(f.peakKpa), 0);
  assert.equal(val<number>(f.left.loadedAreaCm2), 0);
  assert.deepEqual(f.shares, { kind: "unavailable", reason: "zero-load" });
  assert.deepEqual(f.differencePp, { kind: "unavailable", reason: "zero-load" });
  assert.deepEqual(f.left.copMm, { kind: "unavailable", reason: "zero-load" });
});

test("a sensor reading exactly 0 inside a loaded foot still counts as measured", () => {
  const foot = analyzeFoot("left", [s("A", "left", 0, 2, 0, 0), s("B", "left", 50, 4, 40, 0)]);
  assert.equal(foot.state, "ok");
  near(val<number>(foot.forceN), 20);
  near(val<number>(foot.loadedAreaCm2), 4); // the 0 kPa sensor adds no loaded area
  near(val<{ x: number; y: number }>(foot.copMm).x, 40);
});

test("missing opposite foot: no 100% share is inferred", () => {
  const f = analyzeFrame({ timestampMs: 0, samples: fixture().samples.filter((x) => x.side === "left") });
  near(val<number>(f.left.forceN), 40);
  assert.deepEqual(f.right.forceN, { kind: "unavailable", reason: "missing-foot" });
  assert.deepEqual(f.shares, { kind: "unavailable", reason: "missing-foot" });
  assert.deepEqual(f.differencePp, { kind: "unavailable", reason: "missing-foot" });
  assert.deepEqual(f.peakKpa, { kind: "unavailable", reason: "missing-foot" });
});

test("all sensors of a foot reporting 'missing' counts as a disconnected foot", () => {
  const f = analyzeFrame({
    timestampMs: 0,
    samples: [s("L-A", "left", 100, 2, 0, 0), s("R-A", "right", null, 4, 60, 10, 0, "missing")],
  });
  assert.deepEqual(f.right.forceN, { kind: "unavailable", reason: "missing-foot" });
  assert.equal(f.shares.kind, "unavailable");
});

test("missing sensor inside a foot makes that foot's metrics unavailable", () => {
  const f = analyzeFrame({
    timestampMs: 0,
    samples: [s("L-A", "left", 100, 2, 0, 0), s("L-B", "left", null, 4, 40, 0, 0, "missing"), s("R-A", "right", 150, 4, 60, 10)],
  });
  assert.equal(f.left.state, "missing-sensor");
  assert.deepEqual(f.left.forceN, { kind: "unavailable", reason: "missing-sensor" });
  assert.deepEqual(f.left.copMm, { kind: "unavailable", reason: "missing-sensor" });
  assert.deepEqual(f.left.peakKpa, { kind: "unavailable", reason: "missing-sensor" });
  assert.deepEqual(f.shares, { kind: "unavailable", reason: "missing-sensor" });
  near(val<number>(f.right.forceN), 60); // the other foot is unaffected
});

test("invalid input is rejected explicitly", () => {
  const bad = (p: Partial<PressureSample>) => analyzeFoot("left", [{ ...s("A", "left", 10, 2, 0, 0), ...p }]);
  assert.equal(bad({ pressureKpa: -1 }).state, "invalid-input");
  assert.equal(bad({ pressureKpa: Number.NaN }).state, "invalid-input");
  assert.equal(bad({ pressureKpa: Infinity }).state, "invalid-input");
  assert.equal(bad({ pressureKpa: null }).state, "invalid-input"); // "ok" without a value
  assert.equal(bad({ areaCm2: 0 }).state, "invalid-input");
  assert.equal(bad({ areaCm2: -3 }).state, "invalid-input");
  assert.equal(bad({ areaCm2: Number.NaN }).state, "invalid-input");
  assert.equal(bad({ positionMm: { x: Number.NaN, y: 0 } }).state, "invalid-input");
  assert.equal(analyzeFoot("left", [s("A", "left", 1, 1, 0, 0), s("A", "left", 1, 1, 5, 0)]).state, "invalid-input"); // duplicate id
  assert.ok(validateSample({ ...s("A", "left", 10, 2, 0, 0), pressureKpa: -5 })?.includes("negative"));
  assert.equal(validateSample(s("A", "left", null, 2, 0, 0, 0, "missing")), null); // missing is not invalid
  // invalid on one foot keeps the share unavailable with the invalid reason
  const f = analyzeFrame({ timestampMs: 0, samples: [s("A", "left", -2, 2, 0, 0), s("B", "right", 5, 2, 0, 0)] });
  assert.deepEqual(f.shares, { kind: "unavailable", reason: "invalid-input" });
  assert.deepEqual(analyzeFrame({ timestampMs: Number.NaN, samples: [] }).shares, { kind: "unavailable", reason: "invalid-input" });
});

test("frame peak vs session peak", () => {
  const frames = [fixture(0), { timestampMs: 50, samples: fixture(50).samples.map((x) => (x.sensorId === "L-B" ? { ...x, pressureKpa: 200 } : x)) }];
  const analyses = frames.map(analyzeFrame);
  near(val<number>(analyses[0].peakKpa), 150); // frame 0
  near(val<number>(analyses[1].peakKpa), 200); // frame 1
  const session = analyzeSession(analyses);
  near(val<number>(session.peakKpa.overall), 200);
  near(val<number>(session.peakKpa.left), 200);
  near(val<number>(session.peakKpa.right), 150);
  assert.equal(session.completeFrames, 2);
});

test("session peak ignores frames where the metric is unavailable, and is unavailable if none exist", () => {
  const ok = fixture(0);
  const noRight: PressureFrame = { timestampMs: 50, samples: fixture(50).samples.filter((x) => x.side === "left") };
  const session = analyzeSession([analyzeFrame(ok), analyzeFrame(noRight)]);
  near(val<number>(session.peakKpa.overall), 150); // only the complete frame counts
  assert.equal(session.completeFrames, 1);
  const none = analyzeSession([analyzeFrame(noRight)]);
  assert.deepEqual(none.peakKpa.overall, { kind: "unavailable", reason: "missing-foot" });
  assert.deepEqual(none.meanShares, { kind: "unavailable", reason: "missing-foot" });
  near(val<number>(none.peakKpa.left), 100);
  assert.deepEqual(analyzeSession([]).peakKpa.overall, { kind: "unavailable", reason: "no-frames" });
});

test("session mean share is force-weighted over complete frames", () => {
  const f2: PressureFrame = { timestampMs: 50, samples: [s("L-A", "left", 100, 2, 0, 0, 50), s("R-A", "right", 400, 2, 60, 10, 50)] }; // 20 N / 80 N
  const session = analyzeSession([analyzeFrame(fixture(0)), analyzeFrame(f2)]); // 40+20 = 60 N left, 60+80 = 140 N right
  const sh = val<{ leftPct: number; rightPct: number }>(session.meanShares);
  near(sh.leftPct, 30);
  near(sh.rightPct, 70);
  near(val<number>(session.meanDifferencePp), 40);
});

test("CoP path length and speed; gaps are not bridged", () => {
  const frame = (t: number, x: number, y: number, load = true): PressureFrame => ({
    timestampMs: t,
    samples: [s("L-A", "left", load ? 100 : 0, 1, x, y, t), s("R-A", "right", 10, 1, 0, 0, t)],
  });
  const a = [frame(0, 0, 0), frame(100, 3, 4), frame(200, 3, 4, false), frame(300, 9, 12)].map(analyzeFrame);
  const p = val<{ lengthMm: number; meanSpeedMmPerS: number; points: unknown[] }>(copPath(a, "left", 0, 300));
  near(p.lengthMm, 5); // (0,0)->(3,4) only; the zero-load frame breaks the path
  near(p.meanSpeedMmPerS, 50); // 5 mm over 0.1 s
  assert.equal(p.points.length, 3);
  assert.equal(copPath(a, "left", 200, 200).kind, "unavailable");
});

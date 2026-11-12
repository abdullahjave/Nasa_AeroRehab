import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "./fixtures";
import { GAIT_PHASES } from "./gait";

// Every astronaut must have enough history for the trend charts to draw lines, and the Day 42 balance card must show a score.

test("all three astronauts have a real history: at least 10 knee, 8 walking and 8 balance-index sessions", () => {
  for (const a of ASTRONAUTS) {
    const rom = a.sessions.filter((s) => s.knee.romDeg !== null).length;
    const walk = a.sessions.filter((s) => s.gait?.speedMs != null).length;
    const bal = a.sessions.filter((s) => s.balance?.index != null).length;
    assert.ok(rom >= 10, `${a.id} ROM sessions: ${rom}`);
    assert.ok(walk >= 8, `${a.id} walking sessions: ${walk}`);
    assert.ok(bal >= 8, `${a.id} balance-index sessions: ${bal}`);
    assert.equal(new Set(a.sessions.map((s) => s.id)).size, a.sessions.length, `${a.id} has duplicate session ids`);
  }
});

test("the latest session of every astronaut has a Balance Index (no 'Unavailable' card)", () => {
  for (const a of ASTRONAUTS) {
    const last = a.sessions[a.sessions.length - 1];
    assert.equal(typeof last.balance?.index, "number", a.id);
    assert.ok(last.balance!.profile, `${a.id} stability profile`);
  }
});

test("every astronaut profile carries the shared portrait, and the gait phases the images are matched to exist", () => {
  for (const a of ASTRONAUTS) assert.equal(a.profile.portrait, "/images/astronaut-portrait.webp");
  for (const k of ["heel-strike", "loading", "mid-stance", "terminal-stance", "pre-swing", "heel-strike-2"]) assert.ok(GAIT_PHASES.some((p) => p.key === k), k);
});

import { progressTrend } from "./progress";
import { pressureTrend } from "../pressure/recording";

test("Progress Trend is computed from the sessions: ROM % of baseline matches the session, and a missing walk is a gap, not a number", () => {
  for (const a of ASTRONAUTS) {
    const t = progressTrend(a);
    assert.equal(t.length, 8, a.id);
    assert.deepEqual(t.map((p) => p.missionDay), [...t.map((p) => p.missionDay)].sort((x, y) => x - y));
    for (const p of t) {
      const s = a.sessions.find((x) => x.id === p.sessionId)!;
      assert.equal(p.kneeRomPctOfBaseline, Math.round((s.knee.romDeg! / s.joint.baseline!.romDeg) * 1000) / 10);
      assert.equal(p.gaitSymmetryPct, s.gait?.symmetryPct ?? null);
    }
  }
});

test("Load Trend has one real point per session with an insole recording; one offline insole gives that foot's peak, not a gap", () => {
  for (const a of ASTRONAUTS) {
    const t = pressureTrend(a);
    assert.equal(t.length, 8, a.id);
    assert.ok(t.every((r) => r.peakKpa !== null), `${a.id} has a gap in the peak line`);
    assert.ok(t.every((r) => r.source !== "backfill" as string));
  }
  const alv = ASTRONAUTS.find((a) => a.id === "astro-alvarez")!;
  assert.ok(alv.sensors.every((x) => x.status !== "offline"), "Alvarez has no offline insole"); // Settings > Pressure Stream Status shows both insoles connected
  const last = pressureTrend(alv).at(-1)!;
  assert.equal(last.source, "session");
  assert.notEqual(last.differencePp, null);
});

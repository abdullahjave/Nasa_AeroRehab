import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "./fixtures";

// Speed, cadence, stride length and step time of one session describe the same steady interval.
const sessions = ASTRONAUTS.flatMap((a) => a.sessions.filter((s) => s.gait).map((s) => ({ a, s, g: s.gait! })));

test("there are gait sessions to check", () => assert.ok(sessions.length > 15));

test("speed = (cadence / 120) x stride length for every session (rounding tolerance)", () => {
  for (const { s, g } of sessions) {
    const implied = ((g.cadenceSpm as number) / 120) * (g.strideLengthM as number);
    assert.ok(Math.abs(implied - (g.speedMs as number)) <= 0.015, `${s.id}: implied ${implied.toFixed(3)} vs speed ${g.speedMs}`);
  }
});

test("step time = 60 / cadence and stride time = 2 x step time", () => {
  for (const { s, g } of sessions) {
    assert.ok(Math.abs((g.stepTimeS as number) - 60 / (g.cadenceSpm as number)) <= 0.006, `${s.id} step time`);
    assert.ok(Math.abs((g.strideTimeS as number) - 2 * (g.stepTimeS as number)) <= 0.011, `${s.id} stride time`);
  }
});

test("the per-stride series centres on the headline stride length", () => {
  for (const { s, g } of sessions) {
    const arr = g.strideSeries!.strideLengthM;
    const mean = arr.reduce((x, y) => x + y, 0) / arr.length;
    assert.ok(Math.abs(mean - (g.strideLengthM as number)) <= 0.03, `${s.id}: series mean ${mean.toFixed(3)} vs ${g.strideLengthM}`);
  }
});

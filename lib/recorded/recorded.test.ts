import test from "node:test";
import assert from "node:assert/strict";
import { computeRom, emptySession, recordedAstronaut, recordedAstronauts, romTrend } from "./build";
import { SEED_ASTRONAUTS, SEED_MISSION } from "../db/seed";
import { initialsOf, missionDayOf, parseRecordedAt, readNumber, validateProfile, validateSession } from "./validate";
import { buildAlerts } from "../alerts/build";
import { insightView } from "../insights";
import { geminiInputFor } from "../alerts/gemini";
import type { RecordedSession, RecordedSnapshot } from "./types";

const ids = SEED_ASTRONAUTS.map((a) => a.id);
const good = { astronautId: "astro-chen", recordedAt: "2026-11-02T09:30", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: "4", maxAngleDeg: "120", torqueNm: "55" };

test("ROM uses the existing convention (maximum minus minimum) and needs both angles", () => {
  assert.equal(computeRom(4, 120), 116);
  assert.equal(computeRom(null, 120), null);
  assert.equal(computeRom(4, null), null);
  assert.equal(computeRom(130, 120), null);
  assert.equal(computeRom(Number.NaN, 120), null);
});

test("a valid session passes, strings from the form become numbers, and the time is read as UTC", () => {
  const v = validateSession(good, SEED_MISSION, ids);
  assert.equal(v.ok, true);
  if (v.ok) {
    assert.equal(v.value.minAngleDeg, 4);
    assert.equal(v.value.maxAngleDeg, 120);
    assert.equal(v.value.torqueNm, 55);
    assert.equal(v.value.recordedAt, "2026-11-02T09:30:00.000Z");
  }
});

test("input validation: minimum above maximum, non-finite, unit text, wrong units, ranges, empty readings", () => {
  const bad = (patch: object) => { const v = validateSession({ ...good, ...patch }, SEED_MISSION, ids); assert.equal(v.ok, false); return v.ok ? {} : v.errors; };
  assert.match(bad({ minAngleDeg: "130", maxAngleDeg: "120" }).maxAngleDeg, /greater than or equal/);
  assert.match(bad({ minAngleDeg: "abc" }).minAngleDeg, /number in degrees/);
  assert.match(bad({ maxAngleDeg: "120 deg" }).maxAngleDeg, /number in degrees/);
  assert.match(bad({ maxAngleDeg: Number.POSITIVE_INFINITY }).maxAngleDeg, /number in degrees/);
  assert.match(bad({ maxAngleDeg: Number.NaN }).maxAngleDeg, /number in degrees/);
  assert.match(bad({ maxAngleDeg: "200" }).maxAngleDeg, /between/);
  assert.match(bad({ torqueNm: "-3" }).torqueNm, /between 0 and/);
  assert.match(bad({ torqueNm: "55 Nm" }).torqueNm, /number in Nm/);
  assert.match(bad({ angleUnit: "rad" }).minAngleDeg, /degrees/);
  assert.match(bad({ torqueUnit: "lbf" }).torqueNm, /newton-metres/);
  assert.match(bad({ minAngleDeg: "", maxAngleDeg: "", torqueNm: "" }).minAngleDeg, /at least one reading/);
  assert.match(bad({ side: "up" }).side, /left or right/);
  assert.match(bad({ protocol: "x" }).protocol, /protocol/);
  assert.match(bad({ movement: "x" }).movement, /movement/);
  assert.match(bad({ activity: "   " }).activity, /activity/);
  assert.match(bad({ astronautId: "astro-nobody" }).astronautId, /astronaut/);
  assert.match(bad({ recordedAt: "yesterday" }).recordedAt, /date and time/);
  assert.match(bad({ recordedAt: "2026-09-01T10:00" }).recordedAt, /Day 1 to 42/);
  assert.match(bad({ recordedAt: "2027-06-01T10:00" }).recordedAt, /Day 1 to 42/);
});

test("readings may be partial (nullable) and equal angles are allowed", () => {
  const only = validateSession({ ...good, minAngleDeg: "", torqueNm: "" }, SEED_MISSION, ids);
  assert.equal(only.ok && only.value.minAngleDeg, null);
  assert.equal(validateSession({ ...good, minAngleDeg: "90", maxAngleDeg: "90" }, SEED_MISSION, ids).ok, true);
  assert.equal(readNumber(" 12.5 "), 12.5);
  assert.ok(Number.isNaN(readNumber("1e3")));
  assert.equal(readNumber(""), null);
});

test("timestamps, mission day and profile validation", () => {
  assert.equal(parseRecordedAt("2026-11-10 09:30"), "2026-11-10T09:30:00.000Z");
  assert.equal(parseRecordedAt("2026-11-10T09:30:00+02:00"), "2026-11-10T07:30:00.000Z");
  assert.equal(parseRecordedAt("2026-13-10T09:30"), null);
  assert.equal(missionDayOf("2026-09-30T00:00:00.000Z", SEED_MISSION), 1);
  assert.equal(missionDayOf("2026-11-10T23:59:00.000Z", SEED_MISSION), 42);
  assert.equal(validateProfile({ ageYears: "41", heightCm: 168, role: " Pilot " }).ok, true);
  const p = validateProfile({ ageYears: "17", massKg: "abc", affectedLimb: "up", fullName: "" });
  assert.equal(p.ok, false);
  if (!p.ok) assert.deepEqual(Object.keys(p.errors).sort(), ["affectedLimb", "ageYears", "fullName", "massKg"]);
  assert.equal(validateProfile({ crewCode: "X-1" }).ok, false); // crew code is not editable
  assert.equal(initialsOf("Dr. Mei Chen"), "MC");
});

// ---- builder: recorded sessions become the shapes the pages read, with nothing taken from demo fixtures ----
const row = (id: string, over: Partial<RecordedSession> = {}): RecordedSession => ({ id, astronautId: "astro-chen", recordedAt: "2026-11-02T09:30:00.000Z", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", source: "manual", minAngleDeg: 4, maxAngleDeg: 124, torqueNm: 60, updatedAt: "", ...over });
const snap = (sessions: RecordedSession[], baselines: RecordedSnapshot["baselines"] = []): RecordedSnapshot => ({ mission: SEED_MISSION, astronauts: SEED_ASTRONAUTS, sessions, baselines, walkingSessions: [], pressureAssessments: [], balanceAssessments: [], sensorImports: [], alertAcks: [] });
const chenBase = row("rec-base", { recordedAt: "2026-10-20T09:00:00.000Z" }); // ROM 120
const chenNow = row("rec-now", { recordedAt: "2026-11-05T09:00:00.000Z", minAngleDeg: 6, maxAngleDeg: 112 }); // ROM 106
const bl = { astronautId: "astro-chen", side: "left" as const, movement: "knee-flexion-extension" as const, protocol: "active-knee-flexion" as const, sessionId: "rec-base" };

test("recorded sessions carry only entered values: no samples, gait, pressure or balance are invented", () => {
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snap([chenBase, chenNow], [bl]));
  assert.equal(a.sessions.length, 2);
  for (const s of a.sessions) {
    assert.deepEqual(s.kneeSamples, []);
    assert.equal(s.gait, null);
    assert.equal(s.pressureSpec, null);
    assert.equal(s.balance, null);
    assert.equal(s.fatigue, null);
    assert.deepEqual(s.scenarioEvents, []);
    assert.equal(s.recorded?.source, "manual");
    assert.equal(s.knee.currentAngleDeg, null);
  }
  assert.deepEqual(a.sensors, []);
  assert.deepEqual(a.trend, []);
  assert.deepEqual(a.balanceTrials, []);
  assert.equal(a.overview.kis, null);
  assert.equal(a.sessions[1].missionDay, 37);
});

test("baseline difference comes from one selector: current 106°, baseline 120°, -14° (-11.7%) on every page", () => {
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snap([chenBase, chenNow], [bl]));
  const now = a.sessions[1];
  assert.equal(now.knee.romDeg, 106);
  assert.equal(now.joint.baseline?.romDeg, 120);
  const v = insightView(a, now);
  assert.equal(v.baselineComparable, true);
  assert.equal(v.rom.diff.kind === "value" && v.rom.diff.value, -14);
  assert.equal(v.rom.pct.kind === "value" && Math.round(v.rom.pct.value * 10) / 10, -11.7);
  assert.equal(v.chart.baseline.kind, "unavailable"); // no recorded trace to overlay
  const alerts = buildAlerts(a, now);
  assert.equal(alerts[0].severity, "attention");
  assert.match(alerts[0].why[0], /^Your knee moved 14° less than in your baseline session/);
  assert.equal(alerts[0].geminiEligible, true); // on request only; the server rebuilds the alert and sends numbers + status, no names or notes
  const input = geminiInputFor(alerts[0])!;
  assert.equal(input.currentValue, 106);
  assert.equal(input.baselineValue, 120);
  assert.equal(input.status, "Needs Attention");
  assert.equal(geminiInputFor(buildAlerts(a, a.sessions[0])[0]), null); // the baseline session itself has nothing to compare
});

test("the baseline session itself, no baseline, and a different knee/protocol never produce a comparison", () => {
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snap([chenBase, chenNow], [bl]));
  const self = a.sessions[0];
  assert.equal(self.joint.baseline, null);
  assert.equal(self.recorded?.isBaseline, true);
  assert.equal(buildAlerts(a, self)[0].label, "Baseline Session");
  const none = recordedAstronaut(SEED_ASTRONAUTS[0], snap([chenBase, chenNow]));
  const al = buildAlerts(none, none.sessions[1])[0];
  assert.equal(al.label, "Baseline Unavailable");
  assert.match(al.changed, /106°/); // current reading stays visible
  const right = row("rec-right", { side: "right", recordedAt: "2026-11-06T09:00:00.000Z" });
  const loaded = row("rec-loaded", { protocol: "loaded-knee-flexion", recordedAt: "2026-11-07T09:00:00.000Z" });
  const mixed = recordedAstronaut(SEED_ASTRONAUTS[0], snap([chenBase, right, loaded], [bl]));
  assert.equal(mixed.sessions[1].joint.baseline, null);
  assert.equal(mixed.sessions[2].joint.baseline, null);
  assert.equal(buildAlerts(mixed, mixed.sessions[1])[0].label, "Baseline Unavailable");
});

test("astronauts are isolated; an astronaut with no sessions gets an explicit empty state, never demo data", () => {
  const okafor = row("rec-ok", { astronautId: "astro-okafor", side: "right", minAngleDeg: 10, maxAngleDeg: 100 });
  const all = recordedAstronauts(snap([chenBase, chenNow, okafor], [bl]));
  const byId = Object.fromEntries(all.map((x) => [x.id, x]));
  assert.equal(byId["astro-chen"].sessions.length, 2);
  assert.equal(byId["astro-okafor"].sessions.length, 1);
  assert.equal(byId["astro-alvarez"].sessions.length, 0);
  assert.equal(byId["astro-okafor"].sessions[0].joint.baseline, null); // Chen's baseline never reaches Okafor
  const empty = emptySession("astro-alvarez", SEED_MISSION);
  assert.equal(empty.recorded?.empty, true);
  assert.equal(empty.knee.romDeg, null);
  const al = buildAlerts(byId["astro-alvarez"], empty);
  assert.equal(al.length, 1);
  assert.equal(al[0].label, "No Sessions Yet");
  assert.equal(al[0].action.label, "Add session");
  assert.equal(al[0].severity, "neutral");
});

test("session-to-session ROM trend is derived from saved sessions only, in time order", () => {
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snap([chenNow, chenBase], [bl]));
  const t = romTrend(a, "left", "active-knee-flexion");
  assert.deepEqual(t.map((x) => x.romDeg), [120, 106]);
  assert.deepEqual(t.map((x) => x.isBaseline), [true, false]);
});

test("a session with only a torque reading shows the torque and no status, not a fake one", () => {
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snap([row("rec-t", { minAngleDeg: null, maxAngleDeg: null, torqueNm: 48 })]));
  assert.equal(a.sessions[0].knee.romDeg, null);
  assert.equal(a.sessions[0].joint.peakTorqueNm, 48);
  const al = buildAlerts(a, a.sessions[0])[0];
  assert.equal(al.severity, "neutral");
  assert.equal(al.label, "Data Unavailable");
});

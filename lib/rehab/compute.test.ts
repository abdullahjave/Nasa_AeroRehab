import test from "node:test";
import assert from "node:assert/strict";
import { applyEdits, completionRate, isSessionComplete, sessionTotals, setCompletion, weeklyAdherence } from "./compute";
import type { ExerciseId, ScheduledSession } from "./types";

const EX: ExerciseId[] = ["sit-to-stand", "resisted-mini-squat", "step-up", "calf-raise"];
const sess = (id: string, day: number, n = 4, required = true): ScheduledSession => ({
  id, programId: "p", missionDay: day,
  assignments: EX.slice(0, n).map((e) => ({ id: `${id}:${e}`, scheduledSessionId: id, exerciseId: e, required })),
});
const near = (a: number, b: number, eps = 1e-9) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);
const done = (s: ScheduledSession, k = s.assignments.length) => Object.fromEntries(s.assignments.slice(0, k).map((a) => [a.id, true]));

test("hand-checked week: adherence 2/3, completion 9/12, time 35 min", () => {
  const a = sess("s1", 1), b = sess("s2", 2), c = sess("s3", 3);
  const comp = { ...done(a), ...done(b), ...done(c, 1) };
  const adh = weeklyAdherence([a, b, c], comp);
  assert.equal(adh.kind, "value");
  if (adh.kind === "value") { assert.equal(adh.num, 2); assert.equal(adh.den, 3); near(adh.pct, 200 / 3); }
  const rate = completionRate([a, b, c], comp);
  if (rate.kind !== "value") throw new Error("expected value");
  assert.equal(rate.num, 9); assert.equal(rate.den, 12); near(rate.pct, 75);
  const t = sessionTotals([a, b, c], comp, [{ scheduledSessionId: "s1", minutes: 15 }, { scheduledSessionId: "s2", minutes: 20 }, { scheduledSessionId: "s3", minutes: 30 }]);
  assert.equal(t.completedSessions, 2);
  assert.equal(t.minutes, 35); // s3 is not complete, so its 30 min do not count
  assert.equal(t.missingDuration, 0);
});

test("no scheduled sessions / no assignments -> Unavailable, not 0%", () => {
  assert.deepEqual(weeklyAdherence([], {}), { kind: "unavailable", reason: "no-scheduled-sessions" });
  assert.deepEqual(completionRate([], {}), { kind: "unavailable", reason: "no-assignments" });
  const empty = sess("e", 1, 0);
  assert.equal(isSessionComplete(empty, {}), false); // a session without required items is not complete
  assert.equal(isSessionComplete(sess("o", 1, 2, false), {}), false);
});

test("missing duration is reported separately; a recorded 0 is kept", () => {
  const a = sess("a", 1), b = sess("b", 2), c = sess("c", 3);
  const comp = { ...done(a), ...done(b), ...done(c) };
  const t = sessionTotals([a, b, c], comp, [{ scheduledSessionId: "a", minutes: 0 }, { scheduledSessionId: "b", minutes: null }]);
  assert.equal(t.completedSessions, 3);
  assert.equal(t.minutes, 0);
  assert.equal(t.missingDuration, 2); // b recorded null, c has no record
  assert.equal(t.recordedDuration, 1); // a: recorded zero
});

test("toggling completion twice does not double count; undo removes it", () => {
  const s = sess("s", 1);
  let c = {};
  c = setCompletion(c, "s:step-up", true);
  const again = setCompletion(c, "s:step-up", true);
  assert.equal(again, c); // idempotent: same object
  let r = completionRate([s], again);
  if (r.kind !== "value") throw new Error();
  assert.equal(r.num, 1);
  c = setCompletion(again, "s:step-up", false);
  c = setCompletion(c, "s:step-up", false);
  r = completionRate([s], c);
  if (r.kind !== "value") throw new Error();
  assert.equal(r.num, 0);
  // edits on top of seeded data: undo a seeded completion
  const merged = applyEdits({ "s:calf-raise": true, "s:step-up": true }, { "s:step-up": false, "s:sit-to-stand": true });
  assert.deepEqual(Object.keys(merged).sort(), ["s:calf-raise", "s:sit-to-stand"]);
});

test("each assignment counts once even if an exercise repeats on other days or the session list repeats", () => {
  const a = sess("d1", 1), b = sess("d2", 2);
  const comp = { "d1:step-up": true, "d2:step-up": true };
  const r = completionRate([a, b, a], comp);
  if (r.kind !== "value") throw new Error();
  assert.equal(r.den, 8);
  assert.equal(r.num, 2);
  assert.equal(sessionTotals([a, a], done(a), [{ scheduledSessionId: "d1", minutes: 10 }]).minutes, 10);
});

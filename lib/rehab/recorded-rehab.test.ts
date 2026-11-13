import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { DEMO_DAY, programFor, recordedRehabInScope, scheduleOf } from "./records";
import { eligibleSessions } from "./context";

const chen = ASTRONAUTS.find((a) => a.id === "astro-chen")!;
const okafor = ASTRONAUTS.find((a) => a.id === "astro-okafor")!;
const sched = scheduleOf(chen, programFor(chen)!).filter((s) => s.missionDay <= DEMO_DAY);
const last = sched[sched.length - 1];
const first = sched[0];
const ids = (s: (typeof sched)[number]) => s.assignments.map((x) => x.id);
const full = { start: 1, end: DEMO_DAY };

test("recorded rehab: no saved completion state means no rehab in scope (a scheduled assignment alone is not recorded)", () => {
  assert.ok(sched.length > 0 && last.assignments.length > 0);
  assert.equal(recordedRehabInScope(sched, {}, full), null);
});

test("recorded rehab: a valid 0% — every item of a touched session saved as not done — shows 0 of N assigned", () => {
  const edits = Object.fromEntries(ids(last).map((id) => [id, false]));
  const r = recordedRehabInScope(sched, edits, full);
  assert.ok(r);
  assert.deepEqual([r!.completion.num, r!.completion.den, r!.completion.pct], [0, last.assignments.length, 0]);
  assert.deepEqual([r!.sessions.num, r!.sessions.den], [0, 1]);
});

test("recorded rehab: partial and full completion are counted against ALL assignments of the touched sessions", () => {
  const n = last.assignments.length;
  let r = recordedRehabInScope(sched, { [ids(last)[0]]: true }, full)!;
  assert.deepEqual([r.completion.num, r.completion.den], [1, n]);          // one ticked item, but the denominator is the whole session
  assert.deepEqual([r.sessions.num, r.sessions.den], [n === 1 ? 1 : 0, 1]);
  r = recordedRehabInScope(sched, Object.fromEntries(ids(last).map((id) => [id, true])), full)!;
  assert.deepEqual([r.completion.num, r.completion.den, r.completion.pct], [n, n, 100]);
  assert.deepEqual([r.sessions.num, r.sessions.den], [1, 1]);
});

test("recorded rehab: only sessions inside the report range count; edits outside the scope give no box", () => {
  const edits = { [ids(first)[0]]: true };
  assert.equal(recordedRehabInScope(sched, edits, { start: last.missionDay, end: DEMO_DAY }), null);
  const inFirst = recordedRehabInScope(sched, edits, { start: first.missionDay, end: first.missionDay })!;
  assert.deepEqual([inFirst.completion.num, inFirst.completion.den], [1, first.assignments.length]);
  // Two touched sessions in scope are added together.
  const two = recordedRehabInScope(sched, { [ids(first)[0]]: true, [ids(last)[0]]: false }, full)!;
  assert.equal(two.completion.den, first.assignments.length + last.assignments.length);
  assert.deepEqual([two.sessions.num, two.sessions.den], [0, 2]);
});

test("recorded rehab: another astronaut's saved state never leaks in", () => {
  const edits = Object.fromEntries(ids(last).map((id) => [id, true]));
  const prog = programFor(okafor);
  assert.ok(prog);
  assert.equal(recordedRehabInScope(scheduleOf(okafor, prog), edits, full), null);
});

// The sample sessions above stand in for "sessions of an explicitly saved recorded plan"; the app cannot save one yet.
test("recorded rehab: the simulated sample plan is NOT eligible in Recorded mode, so stored ticks against it are never counted", () => {
  const edits = Object.fromEntries(ids(last).map((id) => [id, true]));
  for (const ctx of ["ground", "spaceflight"] as const) {
    assert.deepEqual(eligibleSessions(chen, "recorded", ctx), []);
    assert.equal(recordedRehabInScope(eligibleSessions(chen, "recorded", ctx), edits, full), null);
  }
});

import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { CONTEXTS, CONTEXT_LABEL, NO_PLAN_CONTEXT, excludedTicksNote, allEligibleSessions, eligiblePlan, eligibleRatio, eligibleSessions, planItemText, SAMPLE_GROUND_ACTIVITIES } from "./context";
import { applyEdits } from "./compute";
import { DEMO_DAY, programFor, scheduleOf, seededCompletions } from "./records";
import { REHAB_KEYS, effectiveEdits, setEntry, type EditsStore } from "./edits";
import { todaysTasks } from "./tasks";
import { EXERCISES } from "./fixtures";
import { geminiInputFor } from "../alerts/gemini";

const chen = ASTRONAUTS.find((a) => a.id === "astro-chen")!;

test("two contexts with the required labels", () => {
  assert.deepEqual([...CONTEXTS], ["spaceflight", "ground"]);
  assert.equal(CONTEXT_LABEL.spaceflight, "Spaceflight Exercise");
  assert.equal(CONTEXT_LABEL.ground, "Ground / Post-flight Rehab");
  assert.equal(NO_PLAN_CONTEXT, "No plan assigned for this context.");
});

test("eligibility: only the Demo sample plan under Ground / Post-flight; Spaceflight and every Recorded case have no assignments, for all astronauts", () => {
  for (const a of ASTRONAUTS) {
    assert.equal(eligiblePlan(a, "demo", "ground")?.source, "demo-sample");
    assert.ok(eligibleSessions(a, "demo", "ground").length > 0);
    assert.deepEqual(eligibleSessions(a, "demo", "spaceflight"), []);
    assert.deepEqual(eligibleSessions(a, "recorded", "ground"), []);
    assert.deepEqual(eligibleSessions(a, "recorded", "spaceflight"), []);
    assert.deepEqual(allEligibleSessions(a, "recorded"), []);
    assert.equal(allEligibleSessions(a, "demo").length, 1);
  }
});

test("sample plan keeps the existing generic exercises (Single-Leg Balance where present) and stable assignment ids, not display labels", () => {
  assert.deepEqual(SAMPLE_GROUND_ACTIVITIES, ["sit-to-stand", "resisted-mini-squat", "step-up", "calf-raise", "single-leg-balance"]);
  const alvarez = ASTRONAUTS.find((a) => a.id === "astro-alvarez")!;
  assert.ok(programFor(alvarez)!.exercises.includes("single-leg-balance"));
  for (const s of eligibleSessions(chen, "demo", "ground")) for (const x of s.assignments) {
    assert.equal(x.id, `${s.id}:${x.exerciseId}`);
    assert.ok(!x.id.includes(EXERCISES[x.exerciseId].name)); // never the display label
  }
});

test("zero eligible assignments is 'No plan assigned' (unavailable), never 0% or 100%", () => {
  assert.deepEqual(eligibleRatio([], {}), { kind: "unavailable", reason: "no-assignments" });
  assert.deepEqual(eligibleRatio([], { "x:1": true }), { kind: "unavailable", reason: "no-assignments" });
  const today = eligibleSessions(chen, "demo", "ground").find((s) => s.missionDay === DEMO_DAY)!;
  const r = eligibleRatio(today.assignments, {});
  assert.deepEqual([r.kind, r.kind === "value" && r.pct], ["value", 0]);
});

test("percentage = completed / eligible x 100; repeated ticks cannot double-count and undo lowers it", () => {
  const today = eligibleSessions(chen, "demo", "ground").find((s) => s.missionDay === DEMO_DAY)!;
  const ids = today.assignments.map((x) => x.id);
  let c = applyEdits({}, { [ids[0]]: true });
  c = applyEdits(c, { [ids[0]]: true }); // second click
  const dup = eligibleRatio([...today.assignments, ...today.assignments], c); // the same assignments listed twice
  assert.deepEqual(dup.kind === "value" && [dup.num, dup.den, dup.pct], [1, ids.length, 100 / ids.length]);
  c = applyEdits(c, { [ids[0]]: false });
  assert.equal((eligibleRatio(today.assignments, c) as { num: number }).num, 0);
});

test("Overview tasks: Demo lists the sample plan with its scope; Recorded shows no plan, never a 0% or an invented task", () => {
  const sched = scheduleOf(chen, programFor(chen)!);
  const done = seededCompletions(chen, sched);
  const d = todaysTasks(chen, done, DEMO_DAY, "demo");
  assert.equal(d.kind, "tasks");
  if (d.kind === "tasks") { assert.equal(d.total, 4); assert.equal(d.scope, "Ground / Post-flight Rehab"); assert.ok(d.tasks.every((t) => t.context === "ground")); }
  // Ticks stored against sample assignments are ignored by Recorded Overview even if passed in.
  const rec = todaysTasks(chen, Object.fromEntries(sched.flatMap((s) => s.assignments.map((x) => [x.id, true]))), DEMO_DAY, "recorded");
  assert.deepEqual(rec, { kind: "none", day: DEMO_DAY, reason: "no-program" });
});

test("completion storage stays separate per mode and astronaut, and a Recorded read never picks up Demo ticks", () => {
  const sess = eligibleSessions(chen, "demo", "ground").find((s) => s.missionDay === DEMO_DAY)!;
  const id = sess.assignments[0].id;
  const demo: EditsStore = setEntry({}, chen.id, sess.id, id, true);
  const s = { legacy: {}, demo, recorded: {} };
  assert.equal(effectiveEdits("demo", s, chen.id)[id], true);
  assert.deepEqual(effectiveEdits("recorded", s, chen.id), {});
  assert.deepEqual(effectiveEdits("demo", s, "astro-okafor"), {});
  // Existing storage keys are unchanged (nothing was silently moved into a new key or context).
  assert.deepEqual(REHAB_KEYS, { legacy: "aerorehab.rehab.edits.v1", demo: "aerorehab.rehab.edits.demo.v1", recorded: "aerorehab.rehab.edits.recorded.v1", migrated: "aerorehab.rehab.edits.legacy-migrated.v1" });
  // Spaceflight has no eligible assignments, so a ground tick can never appear there.
  const spaceIds = new Set(eligibleSessions(chen, "demo", "spaceflight").flatMap((x) => x.assignments.map((y) => y.id)));
  assert.equal(spaceIds.has(id), false);
});

test("AI inputs: the plan item is a labelled simulated sample or 'no plan assigned'; equipment/context never enters the outgoing payload", () => {
  assert.match(planItemText(chen, "demo"), /sample ground rehab plan, simulated/);
  assert.equal(planItemText(chen, "recorded"), "no plan assigned");
  assert.doesNotMatch(planItemText(chen, "demo"), /ARED|T2|CEVIS|treadmill|cycle/i);
  const alert = { geminiEligible: true, label: "Needs Attention", action: { label: "Continue today's plan" }, values: { baselineDay: 1, metricLabel: "Peak flexion", unit: "degrees", current: 100, baseline: 110, diff: -10, pctChange: -9 } } as never;
  const keys = Object.keys(geminiInputFor(alert, { rehabFocus: "Left knee, post-ACL", affectedLimb: "left", missionDay: 42 })!).sort();
  assert.deepEqual(keys, ["actionText", "baselineDay", "baselineValue", "currentValue", "difference", "metricLabel", "missionDay", "percentChange", "rehabArea", "status", "unit", "metric"].filter((k) => k !== "metricLabel").sort());
});

test("excluded Recorded ticks are explained, never deleted or silently reinterpreted", () => {
  assert.equal(excludedTicksNote(0), null);
  assert.match(excludedTicksNote(1)!, /1 saved completion entry .* is kept in this browser, unchanged, but not counted because no recorded plan is assigned/);
  assert.match(excludedTicksNote(3)!, /3 saved completion entries .* are kept/);
  assert.match(excludedTicksNote(2)!, /Earlier versions counted them/);
});

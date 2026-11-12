import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { applyEdits } from "./compute";
import { programFor, scheduleOf, seededCompletions, DEMO_DAY } from "./records";
import { planMilestone, todaysMilestone, todaysTasks } from "./tasks";

const chen = ASTRONAUTS.find((a) => a.id === "astro-chen")!;
const seeded = (a: typeof chen) => seededCompletions(a, scheduleOf(a, programFor(a)!));

test("Today's Tasks come from the real assignment for the demo day, with completed/assigned counts", () => {
  const t = todaysTasks(chen, seeded(chen));
  assert.equal(t.kind, "tasks");
  if (t.kind !== "tasks") return;
  assert.equal(t.day, DEMO_DAY);
  assert.equal(t.total, 4);
  assert.equal(t.done, t.tasks.filter((x) => x.done).length);
  assert.deepEqual(t.tasks.map((x) => x.name), ["Sit-to-Stand", "Resisted Mini Squat", "Step-Up", "Calf Raise"]);
});

test("completing a task updates the count from the same completion records the Rehabilitation page uses", () => {
  const base = seeded(chen);
  const before = todaysTasks(chen, base);
  if (before.kind !== "tasks") throw new Error("tasks expected");
  const open = before.tasks.find((x) => !x.done)!;
  const after = todaysTasks(chen, applyEdits(base, { [open.assignmentId]: true }));
  if (after.kind !== "tasks") throw new Error("tasks expected");
  assert.equal(after.done, before.done + 1);
  assert.equal(after.tasks.find((x) => x.assignmentId === open.assignmentId)!.done, true);
});

test("no assignment for the day -> an explicit empty state, never an invented schedule", () => {
  // Day 0 is before every program starts.
  assert.deepEqual(todaysTasks(chen, {}, 0), { kind: "none", day: 0, reason: "no-session-today" });
  assert.deepEqual(todaysTasks({ ...chen, id: "astro-nobody" as typeof chen.id }, {}), { kind: "none", day: DEMO_DAY, reason: "no-program" });
});

test("milestone is earned only when every distinct assigned id is complete; repeats never double-count; undo recalculates", () => {
  const ids = ["x:1", "x:2", "x:3"];
  assert.deepEqual(planMilestone(ids, { "x:1": true }), { id: "daily-plan", label: "Daily plan complete", done: 1, total: 3, earned: false });
  // the same id listed twice, or edited twice, is still one task
  assert.equal(planMilestone([...ids, "x:1", "x:1"], { "x:1": true }).done, 1);
  assert.equal(planMilestone(ids, { "x:1": true, "x:2": true, "x:3": true, "other:9": true }).earned, true);
  assert.equal(planMilestone(ids, { "x:1": true, "x:2": true, "x:3": false }).earned, false); // undo
  assert.equal(planMilestone([], {}).earned, false); // nothing assigned: nothing to earn
});

test("today's milestone follows the same records as the count, and is isolated per astronaut", () => {
  const base = seeded(chen);
  const t0 = todaysTasks(chen, base);
  if (t0.kind !== "tasks") throw new Error("tasks expected");
  const all = Object.fromEntries(t0.tasks.map((x) => [x.assignmentId, true]));
  const done = todaysTasks(chen, applyEdits(base, all));
  assert.equal(todaysMilestone(done)?.earned, true);
  assert.equal(todaysMilestone(t0)?.earned, false);
  const okafor = ASTRONAUTS.find((a) => a.id === "astro-okafor")!;
  const o = todaysTasks(okafor, seeded(okafor));
  // Chen's edits do not exist in Okafor's records, so nothing carries over.
  if (o.kind === "tasks") assert.ok(o.tasks.every((x) => !x.assignmentId.startsWith("sess-chen")));
  assert.equal(todaysMilestone({ kind: "none", day: 1, reason: "no-session-today" }), null);
});

import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { clearBaseline, createSession, migrate, seed, setBaseline, snapshot, updateProfile, updateSession } from "./repo";
import { MIGRATIONS } from "./migrations";

// Real SQLite (sql.js, in memory). The test runner compiles lib/ into a temp folder, so sql.js is resolved from the project root.
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
let SQL: SqlJsStatic;
const fresh = async (): Promise<Database> => {
  SQL ??= await requireFromRoot("sql.js")();
  const db = new SQL.Database();
  migrate(db);
  seed(db);
  return db;
};
const input = (over: Record<string, unknown> = {}) => ({ astronautId: "astro-chen", recordedAt: "2026-11-02T09:30", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 120, torqueNm: 55, ...over });

test("migrations are idempotent: a second run applies nothing", async () => {
  const db = await fresh();
  assert.deepEqual(migrate(db), []);
  assert.equal(MIGRATIONS.length, 4);
  const versions = db.exec("SELECT version FROM schema_migrations")[0].values.map((r) => r[0]);
  assert.deepEqual(versions, [1, 2, 3, 4]);
});

test("seed creates one mission and three profiles with EMPTY measurement history, and is idempotent", async () => {
  const db = await fresh();
  const s = snapshot(db);
  assert.equal(s.mission.name, "Artemis-II");
  assert.deepEqual(s.astronauts.map((a) => a.id).sort(), ["astro-alvarez", "astro-chen", "astro-okafor"]);
  assert.equal(s.sessions.length, 0);
  assert.equal(s.baselines.length, 0);
  assert.deepEqual(seed(db), { missions: 0, astronauts: 0 });
  assert.equal(snapshot(db).astronauts.length, 3);
});

test("seeding again never overwrites a profile edit", async () => {
  const db = await fresh();
  const r = updateProfile(db, "astro-chen", { role: "Flight Surgeon", ageYears: "42" });
  assert.equal(r.ok, true);
  seed(db);
  const chen = snapshot(db).astronauts.find((a) => a.id === "astro-chen")!;
  assert.equal(chen.role, "Flight Surgeon");
  assert.equal(chen.ageYears, 42);
  assert.equal(chen.crewCode, "A-007");
});

test("profile edits are validated and only whitelisted fields change; initials follow the name", async () => {
  const db = await fresh();
  const bad = updateProfile(db, "astro-chen", { ageYears: 5 });
  assert.equal(bad.ok, false);
  assert.equal(snapshot(db).astronauts.find((a) => a.id === "astro-chen")!.ageYears, 41);
  const ok = updateProfile(db, "astro-chen", { fullName: "Dr. Mei Lin Chen", crewCode: "HACK-1" });
  assert.equal(ok.ok, true);
  if (ok.ok) { assert.equal(ok.value.initials, "ML"); assert.equal(ok.value.crewCode, "A-007"); }
  assert.equal(updateProfile(db, "astro-nobody", { role: "x" }).ok, false);
});

test("create a session, reopen it, and edit the SAME row: no duplicates", async () => {
  const db = await fresh();
  const c = createSession(db, input());
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.match(c.value.id, /^rec-/);
  assert.equal(snapshot(db).sessions.length, 1);
  const u = updateSession(db, c.value.id, input({ maxAngleDeg: 125, activity: "Strength set" }));
  assert.equal(u.ok, true);
  const s = snapshot(db).sessions;
  assert.equal(s.length, 1);
  assert.equal(s[0].id, c.value.id);
  assert.equal(s[0].maxAngleDeg, 125);
  assert.equal(s[0].activity, "Strength set");
  assert.equal(updateSession(db, "rec-missing", input()).ok, false);
});

test("a failed save changes nothing", async () => {
  const db = await fresh();
  const bad = createSession(db, input({ minAngleDeg: 130, maxAngleDeg: 120 }));
  assert.equal(bad.ok, false);
  assert.equal(snapshot(db).sessions.length, 0);
  const c = createSession(db, input());
  if (!c.ok) throw new Error("setup");
  assert.equal(updateSession(db, c.value.id, input({ minAngleDeg: "x" })).ok, false);
  assert.equal(snapshot(db).sessions[0].minAngleDeg, 4);
  assert.equal(createSession(db, input({ astronautId: "astro-nobody" })).ok, false);
});

test("the database itself rejects invalid rows (CHECK constraints are the last line of defence)", async () => {
  const db = await fresh();
  const insert = (min: number, max: number, side = "left") =>
    db.run("INSERT INTO sessions (id, astronaut_id, recorded_at, activity, side, movement, protocol, source, min_angle_deg, max_angle_deg, created_at, updated_at) VALUES ('x','astro-chen','2026-11-02T09:30:00.000Z','a',?, 'knee-flexion-extension','active-knee-flexion','manual',?,?,'t','t')", [side, min, max]);
  assert.throws(() => insert(130, 120), /CHECK/);
  assert.throws(() => insert(0, 500), /CHECK/);
  assert.throws(() => insert(0, 100, "up"), /CHECK/);
  assert.throws(() => db.run("INSERT INTO sessions (id, astronaut_id, recorded_at, activity, side, movement, protocol, source, created_at, updated_at) VALUES ('y','astro-ghost','t','a','left','knee-flexion-extension','active-knee-flexion','manual','t','t')"), /FOREIGN KEY/);
});

test("baseline: explicit choice from saved sessions, one per astronaut + side + movement + protocol, cleared on request", async () => {
  const db = await fresh();
  const a = createSession(db, input());
  const b = createSession(db, input({ recordedAt: "2026-11-05T09:00", maxAngleDeg: 110 }));
  const other = createSession(db, input({ side: "right" }));
  if (!a.ok || !b.ok || !other.ok) throw new Error("setup");
  assert.equal(setBaseline(db, a.value.id).ok, true);
  assert.deepEqual(snapshot(db).baselines.map((x) => [x.sessionId, x.side]), [[a.value.id, "left"]]);
  // choosing another session in the same context replaces the baseline instead of adding a second
  assert.equal(setBaseline(db, b.value.id).ok, true);
  assert.deepEqual(snapshot(db).baselines.map((x) => x.sessionId), [b.value.id]);
  // a different knee side has its own baseline
  assert.equal(setBaseline(db, other.value.id).ok, true);
  assert.equal(snapshot(db).baselines.length, 2);
  assert.equal(setBaseline(db, "rec-missing").ok, false);
  assert.equal(clearBaseline(db, b.value.id).ok, true);
  assert.equal(snapshot(db).baselines.length, 1);
});

test("a baseline needs both angles, and editing a baseline into a different context or without a ROM drops it", async () => {
  const db = await fresh();
  const partial = createSession(db, input({ minAngleDeg: "" }));
  const full = createSession(db, input({ recordedAt: "2026-11-03T09:00" }));
  if (!partial.ok || !full.ok) throw new Error("setup");
  const r = setBaseline(db, partial.value.id);
  assert.equal(r.ok, false);
  assert.equal(setBaseline(db, full.value.id).ok, true);
  updateSession(db, full.value.id, input({ recordedAt: "2026-11-03T09:00", maxAngleDeg: 118 })); // same context: stays
  assert.equal(snapshot(db).baselines.length, 1);
  updateSession(db, full.value.id, input({ recordedAt: "2026-11-03T09:00", protocol: "loaded-knee-flexion" })); // context changed: dropped
  assert.equal(snapshot(db).baselines.length, 0);
  setBaseline(db, full.value.id);
  updateSession(db, full.value.id, input({ recordedAt: "2026-11-03T09:00", protocol: "loaded-knee-flexion", maxAngleDeg: "" })); // ROM lost: dropped
  assert.equal(snapshot(db).baselines.length, 0);
});

test("data survives export and reopen (what a server restart does)", async () => {
  const db = await fresh();
  const c = createSession(db, input());
  if (!c.ok) throw new Error("setup");
  setBaseline(db, c.value.id);
  updateProfile(db, "astro-okafor", { role: "Commander" });
  const bytes = db.export();
  const again = new SQL.Database(bytes);
  migrate(again);
  seed(again);
  const s = snapshot(again);
  assert.equal(s.sessions.length, 1);
  assert.equal(s.sessions[0].id, c.value.id);
  assert.equal(s.baselines.length, 1);
  assert.equal(s.astronauts.find((a) => a.id === "astro-okafor")!.role, "Commander");
});

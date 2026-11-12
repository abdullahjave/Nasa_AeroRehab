import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { createSession, createWalking, migrate, seed, setBaseline, snapshot, updateWalking } from "../db/repo";
import { MIGRATIONS } from "../db/migrations";
import { SEED_ASTRONAUTS, SEED_MISSION } from "../db/seed";
import { recordedAstronaut, recordedAstronauts } from "./build";
import { validateWalking } from "./validate";
import { walkingCadenceSpm, walkingFor, walkingSpeedMs } from "./walking";
import { buildReport } from "../reports/records";

const ids = SEED_ASTRONAUTS.map((a) => a.id);
const good = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:00", distanceM: "60", durationS: "60", steps: "100" };
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
let SQL: SqlJsStatic;
const fresh = async (): Promise<Database> => { SQL ??= await requireFromRoot("sql.js")(); const db = new SQL.Database(); migrate(db); seed(db); return db; };

test("speed = distance / duration and cadence = steps / duration x 60, unrounded", () => {
  assert.equal(walkingSpeedMs(60, 60), 1);
  assert.equal(walkingCadenceSpm(100, 60), 100);
  assert.equal(walkingSpeedMs(100, 30), 100 / 30); // not rounded to 3.33
  assert.equal(walkingCadenceSpm(95, 40), (95 * 60) / 40);
  assert.equal(walkingSpeedMs(0, 60), 0); // standing still is a real zero
  assert.equal(walkingCadenceSpm(0, 60), 0); // 0 steps is a real zero ...
  assert.equal(walkingCadenceSpm(null, 60), null); // ... a missing count is not
  assert.equal(walkingSpeedMs(60, 0), null);
  assert.equal(walkingSpeedMs(-1, 60), null);
  assert.equal(walkingSpeedMs(60, Number.NaN), null);
});

test("walking validation: duration > 0, distance >= 0, whole non-negative steps, units, dates, blanks stay missing", () => {
  assert.equal(validateWalking(good, SEED_MISSION, ids).ok, true);
  const bad = (patch: object) => { const v = validateWalking({ ...good, ...patch }, SEED_MISSION, ids); assert.equal(v.ok, false); return v.ok ? {} : v.errors; };
  assert.match(bad({ durationS: "0" }).durationS, /greater than zero/);
  assert.match(bad({ durationS: "-5" }).durationS, /greater than zero/);
  assert.match(bad({ durationS: "" }).durationS, /Enter the duration/);
  assert.match(bad({ durationS: "abc" }).durationS, /number in seconds/);
  assert.match(bad({ durationS: Number.POSITIVE_INFINITY }).durationS, /number in seconds/);
  assert.match(bad({ durationS: Number.NaN }).durationS, /number in seconds/);
  assert.match(bad({ distanceM: "-1" }).distanceM, /cannot be negative/);
  assert.match(bad({ distanceM: "60 m" }).distanceM, /number in metres/);
  assert.match(bad({ distanceM: "" }).distanceM, /Enter the distance/);
  assert.match(bad({ steps: "10.5" }).steps, /whole number/);
  assert.match(bad({ steps: "-3" }).steps, /whole number/);
  assert.match(bad({ steps: "ten" }).steps, /whole number/);
  assert.match(bad({ distanceUnit: "km" }).distanceM, /metres/);
  assert.match(bad({ durationUnit: "min" }).durationS, /seconds/);
  assert.match(bad({ recordedAt: "2027-01-01T09:00" }).recordedAt, /Day 1 to 42/);
  assert.match(bad({ astronautId: "astro-x" }).astronautId, /astronaut/);
  const blank = validateWalking({ ...good, steps: "" }, SEED_MISSION, ids);
  assert.equal(blank.ok && blank.value.steps, null); // not entered, not zero
  const zero = validateWalking({ ...good, steps: "0", distanceM: "0" }, SEED_MISSION, ids);
  assert.equal(zero.ok && zero.value.steps, 0);
  assert.equal(zero.ok && zero.value.distanceM, 0);
});

test("database: save Chen 60 m / 60 s / 100 steps, edit the SAME record, a missing step count stays null", async () => {
  const db = await fresh();
  const c = createWalking(db, good);
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.match(c.value.id, /^walk-/);
  assert.equal(c.value.source, "manual");
  const chen = () => recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
  assert.equal(chen().walking?.[0].speedMs, 1);
  assert.equal(chen().walking?.[0].cadenceSpm, 100);
  const u = updateWalking(db, c.value.id, { ...good, distanceM: "90", durationS: "60", steps: "" });
  assert.equal(u.ok, true);
  assert.equal(snapshot(db).walkingSessions.length, 1); // same row
  assert.equal(chen().walking?.[0].id, c.value.id);
  assert.equal(chen().walking?.[0].speedMs, 1.5);
  assert.equal(chen().walking?.[0].cadenceSpm, null);
  assert.equal(chen().walking?.[0].steps, null);
  assert.equal(updateWalking(db, "walk-missing", good).ok, false);
});

test("database rejects bad walking rows; failed saves change nothing", async () => {
  const db = await fresh();
  assert.equal(createWalking(db, { ...good, durationS: "0" }).ok, false);
  assert.equal(snapshot(db).walkingSessions.length, 0);
  const ins = (dist: number, dur: number, steps: number | null) =>
    db.run("INSERT INTO walking_sessions (id, astronaut_id, recorded_at, source, distance_m, duration_s, steps, created_at, updated_at) VALUES ('w','astro-chen','2026-11-10T09:00:00.000Z','manual',?,?,?,'t','t')", [dist, dur, steps]);
  assert.throws(() => ins(60, 0, 1), /CHECK/);
  assert.throws(() => ins(-1, 60, 1), /CHECK/);
  assert.throws(() => ins(60, 60, -1), /CHECK/);
});

test("migration 2 is additive and repeatable: existing profiles, knee sessions and the baseline survive", async () => {
  SQL ??= await requireFromRoot("sql.js")();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  db.exec(MIGRATIONS[0].sql);
  db.run("INSERT INTO schema_migrations VALUES (1, 'init', 't')");
  seed(db);
  const k = createSession(db, { astronautId: "astro-chen", recordedAt: "2026-10-20T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 125 });
  if (!k.ok) throw new Error("setup");
  setBaseline(db, k.value.id);
  assert.deepEqual(migrate(db), [2, 3, 4, 5]); // only the new migrations run
  assert.deepEqual(migrate(db), []); // and never again
  const s = snapshot(db);
  assert.equal(s.astronauts.length, 3);
  assert.equal(s.sessions.length, 1);
  assert.equal(s.baselines.length, 1);
  assert.equal(s.walkingSessions.length, 0);
});

test("walking never mixes between astronauts, and does not disturb knee sessions or baseline comparisons", async () => {
  const db = await fresh();
  const base = createSession(db, { astronautId: "astro-chen", recordedAt: "2026-10-20T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 125 });
  const now = createSession(db, { astronautId: "astro-chen", recordedAt: "2026-11-05T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 118 });
  if (!base.ok || !now.ok) throw new Error("setup");
  setBaseline(db, base.value.id);
  createWalking(db, good);
  createWalking(db, { ...good, astronautId: "astro-okafor", distanceM: "30", durationS: "60", steps: "" });
  const all = recordedAstronauts(snapshot(db));
  const [chen, okafor, alvarez] = ["astro-chen", "astro-okafor", "astro-alvarez"].map((id) => all.find((a) => a.id === id)!);
  assert.equal(chen.walking?.length, 1);
  assert.equal(okafor.walking?.[0].speedMs, 0.5);
  assert.equal(okafor.walking?.[0].cadenceSpm, null);
  assert.deepEqual(alvarez.walking, []);
  assert.equal(walkingFor(alvarez, null), null);
  // knee comparison unchanged: ROM 114 vs 121 = -7 (-5.8%)
  assert.equal(chen.sessions[1].knee.romDeg, 114);
  assert.equal(chen.sessions[1].joint.baseline?.romDeg, 121);
  // Reports: walking adds speed/cadence points without touching the knee ROM reference or mean
  const r = buildReport(chen, { kind: "history", range: { start: 13, end: 42 } });
  const rom = r.rows.find((x) => x.metric === "romDeg")!;
  const speed = r.rows.find((x) => x.metric === "speedMs")!;
  const cad = r.rows.find((x) => x.metric === "cadenceSpm")!;
  assert.equal(rom.current.kind === "value" && rom.current.mean, 117.5);
  assert.equal(speed.current.kind === "value" && speed.current.mean, 1);
  assert.equal(cad.current.kind === "value" && cad.current.mean, 100);
  assert.deepEqual(r.ref, { side: "left", protocol: "active-knee-flexion" });
  assert.equal(r.latestSession?.id, now.value.id); // the latest KNEE session, not the walking one
});

test("Overview picks the walking session from the same mission day, otherwise the latest; an explicit pick wins", async () => {
  const db = await fresh();
  const a = createWalking(db, { ...good, recordedAt: "2026-11-05T09:00" });
  const b = createWalking(db, { ...good, recordedAt: "2026-11-09T09:00", distanceM: "120" });
  createSession(db, { astronautId: "astro-chen", recordedAt: "2026-11-05T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 118 });
  createSession(db, { astronautId: "astro-chen", recordedAt: "2026-11-07T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 118 });
  if (!a.ok || !b.ok) throw new Error("setup");
  const chen = recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
  assert.equal(walkingFor(chen, chen.sessions[0])?.id, a.value.id); // Day 37 knee session -> Day 37 walk
  assert.equal(walkingFor(chen, chen.sessions[1])?.id, b.value.id); // no walk on Day 39 -> latest
  assert.equal(walkingFor(chen, chen.sessions[1], a.value.id)?.id, a.value.id);
});

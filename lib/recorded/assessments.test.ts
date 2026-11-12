import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { createBalance, createPressure, createSession, createWalking, migrate, seed, setBaseline, snapshot, updateBalance, updatePressure } from "../db/repo";
import { MIGRATIONS } from "../db/migrations";
import { SEED_ASTRONAUTS, SEED_MISSION } from "../db/seed";
import { recordedAstronaut, recordedAstronauts } from "./build";
import { assessmentRows, balanceFor, comparableBalance, loadShares, pressureFor, resultantRmsMm } from "./assessments";
import { validateBalance, validatePressure } from "./validate";

const ids = SEED_ASTRONAUTS.map((a) => a.id);
const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
let SQL: SqlJsStatic;
const fresh = async (): Promise<Database> => { SQL ??= await requireFromRoot("sql.js")(); const db = new SQL.Database(); migrate(db); seed(db); return db; };
const P = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:00", protocol: "quiet-standing", leftForceN: "40", rightForceN: "60" };
const B = { astronautId: "astro-chen", recordedAt: "2026-11-10T09:30", protocol: "single-leg-stance-eyes-open", trialSide: "left", durationS: "28", mlRmsMm: "3.2", apRmsMm: "4.1" };
const chen = (db: Database) => recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));

test("load share = foot force / combined force x 100, and the difference is in percentage points", () => {
  const s = loadShares(40, 60);
  assert.equal(s.kind, "value");
  if (s.kind === "value") { assert.equal(s.leftPct, 40); assert.equal(s.rightPct, 60); assert.equal(s.diffPp, 20); assert.equal(s.heavier, "right"); }
  const e = loadShares(50, 50);
  assert.equal(e.kind === "value" && e.diffPp, 0);
  assert.equal(e.kind === "value" && e.heavier, "equal");
});

test("missing side, both zero, and a measured zero with positive load on the other side", () => {
  assert.deepEqual(loadShares(40, null), { kind: "unavailable", reason: "missing-force" });
  assert.deepEqual(loadShares(null, 60), { kind: "unavailable", reason: "missing-force" });
  assert.deepEqual(loadShares(null, null), { kind: "unavailable", reason: "missing-force" });
  assert.deepEqual(loadShares(0, 0), { kind: "unavailable", reason: "no-load" });
  const z = loadShares(0, 60); // a real zero is a real 0%, not "missing"
  assert.equal(z.kind, "value");
  if (z.kind === "value") { assert.equal(z.leftPct, 0); assert.equal(z.rightPct, 100); assert.equal(z.diffPp, 100); assert.equal(z.heavier, "right"); }
  assert.deepEqual(loadShares(-1, 5), { kind: "unavailable", reason: "missing-force" });
  assert.deepEqual(loadShares(Number.NaN, 5), { kind: "unavailable", reason: "missing-force" });
});

test("resultant sway RMS is calculated only from both entered components", () => {
  assert.equal(resultantRmsMm(3, 4), 5);
  assert.equal(resultantRmsMm(3, null), null);
  assert.equal(resultantRmsMm(0, 0), 0);
});

test("pressure validation: finite non-negative readings, units, at least one reading, protocol, blank stays null, zero stays zero", () => {
  assert.equal(validatePressure(P, SEED_MISSION, ids).ok, true);
  const bad = (patch: object) => { const v = validatePressure({ ...P, ...patch }, SEED_MISSION, ids); assert.equal(v.ok, false); return v.ok ? {} : v.errors; };
  assert.match(bad({ leftForceN: "-1" }).leftForceN, /cannot be negative/);
  assert.match(bad({ leftForceN: "abc" }).leftForceN, /number in N/);
  assert.match(bad({ rightForceN: Number.POSITIVE_INFINITY }).rightForceN, /number in N/);
  assert.match(bad({ leftPeakKpa: "-5" }).leftPeakKpa, /cannot be negative/);
  assert.match(bad({ rightPeakKpa: "150 kPa" }).rightPeakKpa, /number in kPa/);
  assert.match(bad({ leftForceN: "99999" }).leftForceN, /or less/);
  assert.match(bad({ protocol: "x" }).protocol, /protocol/);
  assert.match(bad({ forceUnit: "lbf" }).leftForceN, /newtons/);
  assert.match(bad({ pressureUnit: "psi" }).leftPeakKpa, /kilopascals/);
  assert.match(bad({ leftForceN: "", rightForceN: "", leftPeakKpa: "", rightPeakKpa: "" }).leftForceN, /at least one reading/);
  assert.match(bad({ recordedAt: "2027-01-01T09:00" }).recordedAt, /Day 1 to 42/);
  const blank = validatePressure({ ...P, leftForceN: "", rightForceN: "60" }, SEED_MISSION, ids);
  assert.equal(blank.ok && blank.value.leftForceN, null);
  const zero = validatePressure({ ...P, leftForceN: "0", rightForceN: "0" }, SEED_MISSION, ids);
  assert.equal(zero.ok && zero.value.leftForceN, 0);
  assert.equal(validatePressure({ ...P, leftForceN: "", rightForceN: "", leftPeakKpa: "180" }, SEED_MISSION, ids).ok, true); // pressure only
});

test("balance validation: explicit side and protocol, duration > 0, optional non-negative sway, units", () => {
  assert.equal(validateBalance(B, SEED_MISSION, ids).ok, true);
  const bad = (patch: object) => { const v = validateBalance({ ...B, ...patch }, SEED_MISSION, ids); assert.equal(v.ok, false); return v.ok ? {} : v.errors; };
  assert.match(bad({ durationS: "0" }).durationS, /greater than zero/);
  assert.match(bad({ durationS: "" }).durationS, /Enter the observed duration/);
  assert.match(bad({ durationS: "abc" }).durationS, /number in seconds/);
  assert.match(bad({ durationS: Number.NaN }).durationS, /number in seconds/);
  assert.match(bad({ trialSide: "" }).trialSide, /left or right/);
  assert.match(bad({ trialSide: undefined }).trialSide, /left or right/);
  assert.match(bad({ protocol: "" }).protocol, /protocol/);
  assert.match(bad({ mlRmsMm: "-1" }).mlRmsMm, /cannot be negative/);
  assert.match(bad({ apRmsMm: "x" }).apRmsMm, /number in mm/);
  assert.match(bad({ swayUnit: "cm" }).mlRmsMm, /millimetres/);
  assert.match(bad({ durationUnit: "min" }).durationS, /seconds/);
  const none = validateBalance({ ...B, mlRmsMm: "", apRmsMm: "" }, SEED_MISSION, ids);
  assert.equal(none.ok && none.value.mlRmsMm, null);
  const zero = validateBalance({ ...B, mlRmsMm: "0" }, SEED_MISSION, ids);
  assert.equal(zero.ok && zero.value.mlRmsMm, 0);
});

test("database: save 40 N / 60 N, edit the SAME record, a missing side and zeros are kept distinct", async () => {
  const db = await fresh();
  const c = createPressure(db, P);
  assert.equal(c.ok, true);
  if (!c.ok) return;
  assert.match(c.value.id, /^press-/);
  const sh = () => chen(db).pressure?.[0].shares;
  assert.deepEqual(sh(), { kind: "value", leftPct: 40, rightPct: 60, diffPp: 20, heavier: "right" });
  assert.equal(updatePressure(db, c.value.id, { ...P, rightForceN: "" }).ok, true);
  assert.equal(snapshot(db).pressureAssessments.length, 1);
  assert.deepEqual(sh(), { kind: "unavailable", reason: "missing-force" });
  updatePressure(db, c.value.id, { ...P, leftForceN: "0", rightForceN: "0" });
  assert.deepEqual(sh(), { kind: "unavailable", reason: "no-load" });
  updatePressure(db, c.value.id, { ...P, leftForceN: "0", rightForceN: "60" });
  assert.equal(snapshot(db).pressureAssessments[0].leftForceN, 0); // stored zero, not null
  assert.equal(chen(db).pressure?.[0].shares.kind, "value");
  assert.equal(createPressure(db, { ...P, leftForceN: "-1" }).ok, false);
  assert.equal(snapshot(db).pressureAssessments.length, 1);
  assert.equal(updatePressure(db, "press-missing", P).ok, false);
});

test("database: balance trial save and edit in place; comparable history needs the same side AND protocol", async () => {
  const db = await fresh();
  const a = createBalance(db, B);
  createBalance(db, { ...B, recordedAt: "2026-11-08T09:30", mlRmsMm: "3.8", apRmsMm: "" });
  createBalance(db, { ...B, recordedAt: "2026-11-07T09:30", trialSide: "right" });
  createBalance(db, { ...B, recordedAt: "2026-11-06T09:30", protocol: "single-leg-stance-eyes-closed" });
  if (!a.ok) throw new Error("setup");
  assert.equal(updateBalance(db, a.value.id, { ...B, durationS: "30" }).ok, true);
  assert.equal(snapshot(db).balanceAssessments.length, 4);
  const c = chen(db);
  const cur = c.balance!.find((x) => x.id === a.value.id)!;
  assert.equal(cur.durationS, 30);
  assert.equal(cur.resultantRmsMm, Math.sqrt(3.2 ** 2 + 4.1 ** 2));
  assert.deepEqual(comparableBalance(c, cur).map((x) => x.missionDay), [40, 42]);
  assert.equal(updateBalance(db, "bal-missing", B).ok, false);
  assert.equal(createBalance(db, { ...B, durationS: "0" }).ok, false);
});

test("database rejects bad assessment rows (CHECK constraints)", async () => {
  const db = await fresh();
  const pr = (cols: string, vals: unknown[]) => db.run(`INSERT INTO pressure_assessments (id, astronaut_id, recorded_at, protocol, source, ${cols}, created_at, updated_at) VALUES ('x','astro-chen','t','quiet-standing','manual',${vals.map(() => "?").join(",")},'t','t')`, vals as never[]);
  assert.throws(() => pr("left_force_n", [-1]), /CHECK/);
  assert.throws(() => db.run("INSERT INTO pressure_assessments (id, astronaut_id, recorded_at, protocol, source, created_at, updated_at) VALUES ('y','astro-chen','t','quiet-standing','manual','t','t')"), /CHECK/); // no reading at all
  assert.throws(() => db.run("INSERT INTO balance_assessments (id, astronaut_id, recorded_at, protocol, trial_side, source, duration_s, created_at, updated_at) VALUES ('z','astro-chen','t','single-leg-stance-eyes-open','left','manual',0,'t','t')"), /CHECK/);
});

test("migration 3 is additive: existing profiles, knee sessions, baseline and walking sessions survive", async () => {
  SQL ??= await requireFromRoot("sql.js")();
  const db = new SQL.Database();
  db.run("PRAGMA foreign_keys = ON");
  db.run("CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  for (const m of MIGRATIONS.slice(0, 2)) { db.exec(m.sql); db.run("INSERT INTO schema_migrations VALUES (?, ?, 't')", [m.version, m.name]); }
  seed(db);
  const k = createSession(db, { astronautId: "astro-chen", recordedAt: "2026-10-20T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 125 });
  if (!k.ok) throw new Error("setup");
  setBaseline(db, k.value.id);
  createWalking(db, { astronautId: "astro-chen", recordedAt: "2026-11-10T09:00", distanceM: 60, durationS: 60, steps: 100 });
  assert.deepEqual(migrate(db), [3, 4]);
  assert.deepEqual(migrate(db), []);
  const s = snapshot(db);
  assert.equal(s.sessions.length, 1);
  assert.equal(s.baselines.length, 1);
  assert.equal(s.walkingSessions.length, 1);
  assert.equal(s.pressureAssessments.length, 0);
  assert.equal(s.balanceAssessments.length, 0);
});

test("isolation across Chen, Okafor and Alvarez; Overview picks same-day else latest, an explicit pick wins", async () => {
  const db = await fresh();
  const p1 = createPressure(db, { ...P, recordedAt: "2026-11-05T09:00" });
  const p2 = createPressure(db, { ...P, recordedAt: "2026-11-09T09:00", leftForceN: "10", rightForceN: "30" });
  createPressure(db, { ...P, astronautId: "astro-okafor", leftForceN: "55", rightForceN: "45" });
  createBalance(db, { ...B, astronautId: "astro-okafor", trialSide: "right" });
  createSession(db, { astronautId: "astro-chen", recordedAt: "2026-11-05T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 118 });
  createSession(db, { astronautId: "astro-chen", recordedAt: "2026-11-07T09:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 118 });
  if (!p1.ok || !p2.ok) throw new Error("setup");
  const [ch, ok, al] = ["astro-chen", "astro-okafor", "astro-alvarez"].map((id) => recordedAstronauts(snapshot(db)).find((a) => a.id === id)!);
  assert.equal(ch.pressure?.length, 2);
  assert.equal(ok.pressure?.length, 1);
  assert.deepEqual(al.pressure, []);
  assert.deepEqual(al.balance, []);
  assert.equal(ch.balance?.length, 0);
  assert.equal(ok.balance?.length, 1);
  assert.equal(pressureFor(al, null), null);
  assert.equal(balanceFor(al, null), null);
  assert.equal(pressureFor(ch, ch.sessions[0])?.id, p1.value.id); // Day 37 knee session -> Day 37 assessment
  assert.equal(pressureFor(ch, ch.sessions[1])?.id, p2.value.id); // nothing on Day 39 -> latest
  assert.equal(pressureFor(ch, ch.sessions[1], p1.value.id)?.id, p1.value.id);
});

test("report rows: comparable only, units and observation counts, unmeasured readings skipped, real zeros counted", async () => {
  const db = await fresh();
  createPressure(db, { ...P, recordedAt: "2026-11-05T09:00", leftForceN: "40", rightForceN: "60", leftPeakKpa: "100" });
  createPressure(db, { ...P, recordedAt: "2026-11-06T09:00", leftForceN: "0", rightForceN: "50", leftPeakKpa: "" }); // zero left force = 0%, peak not measured
  createPressure(db, { ...P, recordedAt: "2026-11-07T09:00", leftForceN: "30", rightForceN: "", protocol: "quiet-standing" }); // missing side: no shares
  createPressure(db, { ...P, recordedAt: "2026-11-08T09:00", protocol: "walking-trial", leftForceN: "10", rightForceN: "10" }); // reference protocol is the LATEST one
  createBalance(db, { ...B, recordedAt: "2026-11-05T09:00", mlRmsMm: "2" });
  createBalance(db, { ...B, recordedAt: "2026-11-06T09:00", mlRmsMm: "4", apRmsMm: "" });
  createBalance(db, { ...B, recordedAt: "2026-11-07T09:00", trialSide: "right", mlRmsMm: "99" });
  const a = chen(db);
  const rows = Object.fromEntries(assessmentRows(a, { start: 13, end: 42 }).map((r) => [r.key, r]));
  // pressure reference = walking-trial (latest): only that one assessment is comparable
  assert.equal(rows.leftShare.value.kind === "value" && rows.leftShare.value.mean, 50);
  assert.equal(rows.leftShare.value.kind === "value" && rows.leftShare.value.n, 1);
  // balance reference = latest = right leg (Day 38): only the right-leg trial counts
  assert.equal(rows.ml.value.kind === "value" && rows.ml.value.mean, 99);
  assert.equal(rows.ml.value.kind === "value" && rows.ml.value.n, 1);
  assert.equal(rows.ap.value.kind === "value" && rows.ap.value.mean, 4.1); // the right-leg trial carries AP 4.1; the left-leg trials do not count
  // a narrower range with only the quiet-standing records
  const q = Object.fromEntries(assessmentRows(a, { start: 36, end: 39 }).map((r) => [r.key, r]));
  assert.equal(q.leftShare.value.kind === "value" && q.leftShare.value.n, 2); // 40% and 0% (a real zero); the Day 39 missing-side record has no share
  assert.equal(q.leftShare.value.kind === "value" && q.leftShare.value.mean, 20);
  assert.equal(q.leftPeak.value.kind === "value" && q.leftPeak.value.n, 1); // the unmeasured peak is skipped, not 0
  assert.equal(q.leftPeak.value.kind === "value" && q.leftPeak.value.mean, 100);
  // empty range
  const none = assessmentRows(a, { start: 1, end: 5 });
  assert.ok(none.every((r) => r.value.kind === "unavailable"));
});

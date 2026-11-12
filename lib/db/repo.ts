import type { Database, SqlValue } from "sql.js";
import { MIGRATIONS } from "./migrations";
import { listImports } from "./imports";
import { listAcks } from "./acks";
import { SEED_ASTRONAUTS, SEED_MISSION } from "./seed";
import { computeRom } from "../recorded/build";
import { initialsOf, validateBalance, validatePressure, validateProfile, validateSession, validateWalking, type SessionValue, type WalkingValue } from "../recorded/validate";
import type { FieldErrors, ProfileInput, RecordedBaseline, RecordedProfile, RecordedSession, RecordedBalance, RecordedPressure, RecordedSnapshot, RecordedWalking, Side } from "../recorded/types";

// Repository over a sql.js (SQLite) database. Pure functions on a Database handle: no file access here, so tests can use :memory:.
// All writes are validated again here (the API validates first, the schema CHECK constraints are the last line of defence).

type Row = Record<string, SqlValue>;

function all(db: Database, sql: string, params: SqlValue[] = []): Row[] {
  const st = db.prepare(sql);
  try {
    st.bind(params);
    const out: Row[] = [];
    while (st.step()) out.push(st.getAsObject() as Row);
    return out;
  } finally { st.free(); }
}

const one = (db: Database, sql: string, params: SqlValue[] = []) => all(db, sql, params)[0] ?? null;
const now = () => new Date().toISOString();

/** Applies pending migrations in order. Safe to run any number of times. Returns the versions applied by this call. */
export function migrate(db: Database): number[] {
  db.run("PRAGMA foreign_keys = ON");
  db.run("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL)");
  const done = new Set(all(db, "SELECT version FROM schema_migrations").map((r) => Number(r.version)));
  const applied: number[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    db.run("BEGIN");
    try {
      db.exec(m.sql);
      db.run("INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)", [m.version, m.name, now()]);
      db.run("COMMIT");
    } catch (e) { db.run("ROLLBACK"); throw e; }
    applied.push(m.version);
  }
  return applied;
}

/** Inserts the mission and the three crew profiles if they are missing. Existing rows (and any edits to them) are left untouched. */
export function seed(db: Database): { missions: number; astronauts: number } {
  const count = () => ({ m: Number(one(db, "SELECT COUNT(*) c FROM mission")?.c ?? 0), a: Number(one(db, "SELECT COUNT(*) c FROM astronauts")?.c ?? 0) });
  const before = count();
  db.run("BEGIN");
  try {
    const m = SEED_MISSION;
    db.run("INSERT OR IGNORE INTO mission (id, name, start_date, total_days, current_day) VALUES (?, ?, ?, ?, ?)", [m.id, m.name, m.startDate, m.totalDays, m.currentDay]);
    for (const a of SEED_ASTRONAUTS) {
      db.run(
        "INSERT OR IGNORE INTO astronauts (id, mission_id, full_name, display_name, crew_code, status, role, age_years, height_cm, mass_kg, rehab_focus, affected_limb, initials, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [a.id, a.missionId, a.fullName, a.displayName, a.crewCode, a.status, a.role, a.ageYears, a.heightCm, a.massKg, a.rehabFocus, a.affectedLimb, a.initials, now()],
      );
    }
    db.run("COMMIT");
  } catch (e) { db.run("ROLLBACK"); throw e; }
  const after = count();
  return { missions: after.m - before.m, astronauts: after.a - before.a };
}

const profileOf = (r: Row): RecordedProfile => ({
  id: String(r.id), missionId: String(r.mission_id), fullName: String(r.full_name), displayName: String(r.display_name), crewCode: String(r.crew_code),
  status: String(r.status), role: String(r.role), ageYears: Number(r.age_years), heightCm: Number(r.height_cm), massKg: Number(r.mass_kg),
  rehabFocus: String(r.rehab_focus), affectedLimb: r.affected_limb as Side, initials: String(r.initials),
});
const num = (v: SqlValue) => (v === null ? null : Number(v));
const sessionOf = (r: Row): RecordedSession => ({
  id: String(r.id), astronautId: String(r.astronaut_id), recordedAt: String(r.recorded_at), activity: String(r.activity), side: r.side as Side,
  movement: r.movement as RecordedSession["movement"], protocol: r.protocol as RecordedSession["protocol"], source: r.source as RecordedSession["source"],
  minAngleDeg: num(r.min_angle_deg), maxAngleDeg: num(r.max_angle_deg), torqueNm: num(r.torque_nm), updatedAt: String(r.updated_at),
});

const walkingOf = (r: Row): RecordedWalking => ({
  id: String(r.id), astronautId: String(r.astronaut_id), recordedAt: String(r.recorded_at), source: r.source as RecordedWalking["source"],
  distanceM: Number(r.distance_m), durationS: Number(r.duration_s), steps: num(r.steps), strideLengthM: num(r.stride_length_m), updatedAt: String(r.updated_at),
});

const pressureOf = (r: Row): RecordedPressure => ({
  id: String(r.id), astronautId: String(r.astronaut_id), recordedAt: String(r.recorded_at), protocol: r.protocol as RecordedPressure["protocol"], source: r.source as RecordedPressure["source"],
  leftForceN: num(r.left_force_n), rightForceN: num(r.right_force_n), leftPeakKpa: num(r.left_peak_kpa), rightPeakKpa: num(r.right_peak_kpa), updatedAt: String(r.updated_at),
});
const balanceOf = (r: Row): RecordedBalance => ({
  id: String(r.id), astronautId: String(r.astronaut_id), recordedAt: String(r.recorded_at), protocol: r.protocol as RecordedBalance["protocol"], trialSide: r.trial_side as Side, source: r.source as RecordedBalance["source"],
  durationS: Number(r.duration_s), mlRmsMm: num(r.ml_rms_mm), apRmsMm: num(r.ap_rms_mm), updatedAt: String(r.updated_at),
});

export function snapshot(db: Database): RecordedSnapshot {
  const m = one(db, "SELECT * FROM mission ORDER BY id LIMIT 1");
  if (!m) throw new Error("database is not seeded: run `npm run db:migrate`");
  return {
    mission: { id: String(m.id), name: String(m.name), startDate: String(m.start_date), totalDays: Number(m.total_days), currentDay: Number(m.current_day) },
    astronauts: all(db, "SELECT * FROM astronauts ORDER BY crew_code").map(profileOf),
    sessions: all(db, "SELECT * FROM sessions ORDER BY recorded_at, id").map(sessionOf),
    walkingSessions: all(db, "SELECT * FROM walking_sessions ORDER BY recorded_at, id").map(walkingOf),
    pressureAssessments: all(db, "SELECT * FROM pressure_assessments ORDER BY recorded_at, id").map(pressureOf),
    balanceAssessments: all(db, "SELECT * FROM balance_assessments ORDER BY recorded_at, id").map(balanceOf),
    sensorImports: listImports(db),
    alertAcks: listAcks(db),
    baselines: all(db, "SELECT * FROM baselines").map((r): RecordedBaseline => ({ astronautId: String(r.astronaut_id), side: r.side as Side, movement: r.movement as RecordedBaseline["movement"], protocol: r.protocol as RecordedBaseline["protocol"], sessionId: String(r.session_id) })),
  };
}

export type Result<T> = { ok: true; value: T } | { ok: false; status: number; errors: FieldErrors };
const notFound = (what: string): Result<never> => ({ ok: false, status: 404, errors: { form: `${what} not found.` } });

export function updateProfile(db: Database, id: string, raw: Record<string, unknown>): Result<RecordedProfile> {
  if (!one(db, "SELECT 1 x FROM astronauts WHERE id = ?", [id])) return notFound("Astronaut");
  const v = validateProfile(raw);
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const set: string[] = [];
  const args: SqlValue[] = [];
  const cols: Record<keyof ProfileInput, string> = { fullName: "full_name", displayName: "display_name", status: "status", role: "role", ageYears: "age_years", heightCm: "height_cm", massKg: "mass_kg", rehabFocus: "rehab_focus", affectedLimb: "affected_limb" };
  for (const [k, val] of Object.entries(v.value)) { set.push(`${cols[k as keyof ProfileInput]} = ?`); args.push(val as SqlValue); }
  if (v.value.fullName) { set.push("initials = ?"); args.push(initialsOf(v.value.fullName)); }
  set.push("updated_at = ?"); args.push(now());
  db.run(`UPDATE astronauts SET ${set.join(", ")} WHERE id = ?`, [...args, id]);
  return { ok: true, value: profileOf(one(db, "SELECT * FROM astronauts WHERE id = ?", [id]) as Row) };
}

function mission(db: Database) {
  const m = one(db, "SELECT * FROM mission ORDER BY id LIMIT 1");
  if (!m) throw new Error("database is not seeded: run `npm run db:migrate`");
  return { id: String(m.id), name: String(m.name), startDate: String(m.start_date), totalDays: Number(m.total_days), currentDay: Number(m.current_day) };
}
const astronautIds = (db: Database) => all(db, "SELECT id FROM astronauts").map((r) => String(r.id));

export function createSession(db: Database, raw: Record<string, unknown>): Result<RecordedSession> {
  const v = validateSession(raw, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const id = `rec-${crypto.randomUUID()}`;
  insert(db, id, v.value);
  return { ok: true, value: sessionOf(one(db, "SELECT * FROM sessions WHERE id = ?", [id]) as Row) };
}

function insert(db: Database, id: string, s: SessionValue) {
  const t = now();
  db.run(
    "INSERT INTO sessions (id, astronaut_id, recorded_at, activity, side, movement, protocol, source, min_angle_deg, max_angle_deg, torque_nm, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [id, s.astronautId, s.recordedAt, s.activity, s.side, s.movement, s.protocol, "manual", s.minAngleDeg, s.maxAngleDeg, s.torqueNm, t, t],
  );
}

/** Edits the same row in place (never inserts). The astronaut cannot be changed. A baseline that no longer fits is dropped. */
export function updateSession(db: Database, id: string, raw: Record<string, unknown>): Result<RecordedSession> {
  const cur = one(db, "SELECT * FROM sessions WHERE id = ?", [id]);
  if (!cur) return notFound("Session");
  const v = validateSession({ ...raw, astronautId: String(cur.astronaut_id) }, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const s = v.value;
  db.run("BEGIN");
  try {
    db.run(
      "UPDATE sessions SET recorded_at=?, activity=?, side=?, movement=?, protocol=?, min_angle_deg=?, max_angle_deg=?, torque_nm=?, updated_at=? WHERE id=?",
      [s.recordedAt, s.activity, s.side, s.movement, s.protocol, s.minAngleDeg, s.maxAngleDeg, s.torqueNm, now(), id],
    );
    // If this session was a baseline, it stays one only while its context is unchanged and it still has both angles.
    db.run(
      "DELETE FROM baselines WHERE session_id = ? AND (side <> ? OR movement <> ? OR protocol <> ? OR ? IS NULL OR ? IS NULL)",
      [id, s.side, s.movement, s.protocol, s.minAngleDeg, s.maxAngleDeg],
    );
    db.run("COMMIT");
  } catch (e) { db.run("ROLLBACK"); throw e; }
  return { ok: true, value: sessionOf(one(db, "SELECT * FROM sessions WHERE id = ?", [id]) as Row) };
}

/** Marks a saved session as the baseline for its own astronaut, side, movement and protocol. Needs both angles (a ROM). */
export function setBaseline(db: Database, sessionId: string): Result<RecordedBaseline> {
  const r = one(db, "SELECT * FROM sessions WHERE id = ?", [sessionId]);
  if (!r) return notFound("Session");
  const s = sessionOf(r);
  if (computeRom(s.minAngleDeg, s.maxAngleDeg) === null) return { ok: false, status: 400, errors: { form: "A baseline needs both a minimum and a maximum angle, so its range of motion can be calculated." } };
  db.run("INSERT OR REPLACE INTO baselines (astronaut_id, side, movement, protocol, session_id) VALUES (?,?,?,?,?)", [s.astronautId, s.side, s.movement, s.protocol, s.id]);
  return { ok: true, value: { astronautId: s.astronautId, side: s.side, movement: s.movement, protocol: s.protocol, sessionId: s.id } };
}

export function clearBaseline(db: Database, sessionId: string): Result<{ cleared: number }> {
  if (!one(db, "SELECT 1 x FROM sessions WHERE id = ?", [sessionId])) return notFound("Session");
  db.run("DELETE FROM baselines WHERE session_id = ?", [sessionId]);
  return { ok: true, value: { cleared: db.getRowsModified() } };
}

// ---------------------------------------------------------------- walking sessions (manual totals)
export function createWalking(db: Database, raw: Record<string, unknown>): Result<RecordedWalking> {
  const v = validateWalking(raw, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const id = `walk-${crypto.randomUUID()}`;
  const t = now();
  const w: WalkingValue = v.value;
  db.run(
    "INSERT INTO walking_sessions (id, astronaut_id, recorded_at, source, distance_m, duration_s, steps, stride_length_m, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    [id, w.astronautId, w.recordedAt, "manual", w.distanceM, w.durationS, w.steps, w.strideLengthM, t, t],
  );
  return { ok: true, value: walkingOf(one(db, "SELECT * FROM walking_sessions WHERE id = ?", [id]) as Row) };
}

/** Edits the same row in place. The astronaut cannot be changed. */
export function updateWalking(db: Database, id: string, raw: Record<string, unknown>): Result<RecordedWalking> {
  const cur = one(db, "SELECT * FROM walking_sessions WHERE id = ?", [id]);
  if (!cur) return notFound("Walking session");
  const v = validateWalking({ ...raw, astronautId: String(cur.astronaut_id) }, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const w = v.value;
  db.run("UPDATE walking_sessions SET recorded_at=?, distance_m=?, duration_s=?, steps=?, stride_length_m=?, updated_at=? WHERE id=?", [w.recordedAt, w.distanceM, w.durationS, w.steps, w.strideLengthM, now(), id]);
  return { ok: true, value: walkingOf(one(db, "SELECT * FROM walking_sessions WHERE id = ?", [id]) as Row) };
}

// ---------------------------------------------------------------- pressure and balance assessments (manual entries)
export function createPressure(db: Database, raw: Record<string, unknown>): Result<RecordedPressure> {
  const v = validatePressure(raw, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const id = `press-${crypto.randomUUID()}`;
  const t = now();
  const p = v.value;
  db.run("INSERT INTO pressure_assessments (id, astronaut_id, recorded_at, protocol, source, left_force_n, right_force_n, left_peak_kpa, right_peak_kpa, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [id, p.astronautId, p.recordedAt, p.protocol, "manual", p.leftForceN, p.rightForceN, p.leftPeakKpa, p.rightPeakKpa, t, t]);
  return { ok: true, value: pressureOf(one(db, "SELECT * FROM pressure_assessments WHERE id = ?", [id]) as Row) };
}

/** Edits the same row in place. The astronaut cannot be changed. */
export function updatePressure(db: Database, id: string, raw: Record<string, unknown>): Result<RecordedPressure> {
  const cur = one(db, "SELECT * FROM pressure_assessments WHERE id = ?", [id]);
  if (!cur) return notFound("Pressure assessment");
  const v = validatePressure({ ...raw, astronautId: String(cur.astronaut_id) }, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const p = v.value;
  db.run("UPDATE pressure_assessments SET recorded_at=?, protocol=?, left_force_n=?, right_force_n=?, left_peak_kpa=?, right_peak_kpa=?, updated_at=? WHERE id=?",
    [p.recordedAt, p.protocol, p.leftForceN, p.rightForceN, p.leftPeakKpa, p.rightPeakKpa, now(), id]);
  return { ok: true, value: pressureOf(one(db, "SELECT * FROM pressure_assessments WHERE id = ?", [id]) as Row) };
}

export function createBalance(db: Database, raw: Record<string, unknown>): Result<RecordedBalance> {
  const v = validateBalance(raw, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const id = `bal-${crypto.randomUUID()}`;
  const t = now();
  const b = v.value;
  db.run("INSERT INTO balance_assessments (id, astronaut_id, recorded_at, protocol, trial_side, source, duration_s, ml_rms_mm, ap_rms_mm, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
    [id, b.astronautId, b.recordedAt, b.protocol, b.trialSide, "manual", b.durationS, b.mlRmsMm, b.apRmsMm, t, t]);
  return { ok: true, value: balanceOf(one(db, "SELECT * FROM balance_assessments WHERE id = ?", [id]) as Row) };
}

export function updateBalance(db: Database, id: string, raw: Record<string, unknown>): Result<RecordedBalance> {
  const cur = one(db, "SELECT * FROM balance_assessments WHERE id = ?", [id]);
  if (!cur) return notFound("Balance assessment");
  const v = validateBalance({ ...raw, astronautId: String(cur.astronaut_id) }, mission(db), astronautIds(db));
  if (!v.ok) return { ok: false, status: 400, errors: v.errors };
  const b = v.value;
  db.run("UPDATE balance_assessments SET recorded_at=?, protocol=?, trial_side=?, duration_s=?, ml_rms_mm=?, ap_rms_mm=?, updated_at=? WHERE id=?",
    [b.recordedAt, b.protocol, b.trialSide, b.durationS, b.mlRmsMm, b.apRmsMm, now(), id]);
  return { ok: true, value: balanceOf(one(db, "SELECT * FROM balance_assessments WHERE id = ?", [id]) as Row) };
}

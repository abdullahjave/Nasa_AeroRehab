import type { Database, SqlValue } from "sql.js";
import { buildAlerts } from "../alerts/build";
import { entryFor, fingerprintOf, type AckEntry } from "../alerts/ack";
import { recordedAstronaut } from "../recorded/build";
import type { FieldErrors, RecordedSnapshot } from "../recorded/types";

// Recorded alert acknowledgements ("Mark as seen") in SQLite. The browser sends only three ids; the alert and the snapshot that is stored are
// rebuilt HERE from the saved records, so a client cannot store a severity, value or source that the data does not show. Append-only and
// idempotent: acknowledging a finding whose latest entry already says the same thing adds nothing. Nothing here resolves or hides an alert.

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

export type AckResult<T> = { ok: true; value: T } | { ok: false; status: number; errors: FieldErrors };
const fail = (status: number, form: string): AckResult<never> => ({ ok: false, status, errors: { form } });
const ID = /^[A-Za-z0-9:._-]{1,160}$/;

const entryOf = (r: Row): AckEntry => ({
  id: String(r.id), astronautId: String(r.astronaut_id), sessionId: String(r.session_id), alertId: String(r.alert_id),
  findingId: r.finding_id === null ? null : String(r.finding_id), acknowledgedAt: String(r.acknowledged_at), fingerprint: String(r.fingerprint),
  severity: r.severity as AckEntry["severity"], severityLabel: String(r.severity_label), title: String(r.title), metric: String(r.metric),
  values: r.value_json === null ? null : (JSON.parse(String(r.value_json)) as AckEntry["values"]),
  source: r.source_json === null ? null : (JSON.parse(String(r.source_json)) as AckEntry["source"]),
  sessionLabel: String(r.session_label), missionDay: Number(r.mission_day), simulatedScenario: r.scenario === null ? null : String(r.scenario),
});

/** Every acknowledgement, oldest first. Small (one row per seen finding state), so it travels in the snapshot. */
export const listAcks = (db: Database): AckEntry[] => all(db, "SELECT * FROM alert_acknowledgements ORDER BY acknowledged_at, id").map(entryOf);

export type AckRequest = { astronautId: unknown; sessionId: unknown; alertId: unknown };
export type AckValue = { entry: AckEntry; duplicate: boolean };

/**
 * Marks one finding as seen. `snap` is the saved data the alert is rebuilt from (the caller passes snapshot(db) so this module has no
 * import cycle with the repository). 403 when the session belongs to another astronaut, 404 when the session or finding does not exist.
 */
export function acknowledgeAlert(db: Database, req: AckRequest, snap: RecordedSnapshot, now: () => string = () => new Date().toISOString()): AckResult<AckValue> {
  const { astronautId, sessionId, alertId } = req;
  if (typeof astronautId !== "string" || typeof sessionId !== "string" || typeof alertId !== "string" || ![astronautId, sessionId, alertId].every((x) => ID.test(x))) {
    return fail(400, "The astronaut, session or alert is missing. Nothing was saved.");
  }
  const profile = snap.astronauts.find((p) => p.id === astronautId);
  if (!profile) return fail(404, "That astronaut was not found. Nothing was saved.");
  const sess = one(db, "SELECT astronaut_id FROM sessions WHERE id = ?", [sessionId]);
  if (!sess) return fail(404, "That session was not found. Nothing was saved.");
  if (String(sess.astronaut_id) !== astronautId) return fail(403, "That session belongs to a different astronaut than the one selected. Nothing was saved.");

  const a = recordedAstronaut(profile, snap);
  const session = a.sessions.find((s) => s.id === sessionId);
  const alert = session ? buildAlerts(a, session).find((x) => x.id === alertId) : undefined;
  if (!alert) return fail(404, "That finding was not found for this session. Nothing was saved.");

  const entry = entryFor(alert, now(), `ack-${crypto.randomUUID()}`);
  const latest = one(db, "SELECT * FROM alert_acknowledgements WHERE astronaut_id = ? AND session_id = ? AND alert_id = ? ORDER BY acknowledged_at DESC, rowid DESC LIMIT 1", [astronautId, sessionId, alertId]);
  if (latest && String(latest.fingerprint) === fingerprintOf(alert)) return { ok: true, value: { entry: entryOf(latest), duplicate: true } }; // unchanged: idempotent

  db.run(
    "INSERT INTO alert_acknowledgements (id, astronaut_id, session_id, alert_id, finding_id, acknowledged_at, fingerprint, severity, severity_label, title, metric, value_json, source_json, session_label, mission_day, scenario) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
    [entry.id, entry.astronautId, entry.sessionId, entry.alertId, entry.findingId, entry.acknowledgedAt, entry.fingerprint, entry.severity, entry.severityLabel, entry.title, entry.metric,
      entry.values ? JSON.stringify(entry.values) : null, entry.source ? JSON.stringify(entry.source) : null, entry.sessionLabel, entry.missionDay, entry.simulatedScenario],
  );
  return { ok: true, value: { entry, duplicate: false } };
}

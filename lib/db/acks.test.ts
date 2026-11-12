import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { acknowledgeAlert } from "./acks";
import { createSession, migrate, seed, setBaseline, snapshot, updateSession } from "./repo";
import { buildAlerts, historyFor, statusOf } from "../alerts";
import { recordedAstronaut } from "../recorded/build";
import { SEED_ASTRONAUTS } from "./seed";

const requireFromRoot = createRequire(path.join(process.cwd(), "package.json"));
let SQL: SqlJsStatic;
const fresh = async (): Promise<Database> => { SQL ??= await requireFromRoot("sql.js")(); const db = new SQL.Database(); db.run("PRAGMA foreign_keys = ON"); migrate(db); seed(db); return db; };
const K = (over: Record<string, unknown>) => ({ astronautId: "astro-chen", recordedAt: "2026-11-10T08:00", activity: "Knee mobility", side: "left", movement: "knee-flexion-extension", protocol: "active-knee-flexion", minAngleDeg: 4, maxAngleDeg: 125, ...over });
const count = (db: Database) => Number(db.exec("SELECT COUNT(*) FROM alert_acknowledgements")[0].values[0][0]);
const idOf = (r: unknown) => (r as { value: { id: string } }).value.id;

/** Chen: a baseline (ROM 121) and a later session (ROM 114, -5.8%): a reduced-ROM finding. Okafor: his own pair. */
async function setup() {
  const db = await fresh();
  const base = createSession(db, K({ recordedAt: "2026-10-20T08:00" })); assert.ok(base.ok);
  setBaseline(db, idOf(base));
  const cur = createSession(db, K({ maxAngleDeg: 118 })); assert.ok(cur.ok);
  const ob = createSession(db, K({ astronautId: "astro-okafor", side: "right", recordedAt: "2026-10-20T08:00" })); assert.ok(ob.ok);
  setBaseline(db, idOf(ob));
  const oc = createSession(db, K({ astronautId: "astro-okafor", side: "right", maxAngleDeg: 118 })); assert.ok(oc.ok);
  const sid = idOf(cur), osid = idOf(oc);
  const chenRec = () => recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db));
  const flagged = () => { const a = chenRec(); return buildAlerts(a, a.sessions.find((s) => s.id === sid)!).find((x) => x.kind === "health" && x.severity !== "good")!; };
  return { db, sid, osid, flagged };
}
const ack = (db: Database, astronautId: string, sessionId: string, alertId: string, now = "2026-11-12T10:00:00.000Z") => acknowledgeAlert(db, { astronautId, sessionId, alertId }, snapshot(db), () => now);

test("migration 5 is additive and repeatable; no acknowledgements exist by default", async () => {
  const db = await fresh();
  assert.deepEqual(migrate(db), []);
  assert.equal(count(db), 0); assert.equal(snapshot(db).alertAcks.length, 0);
});

test("recorded acknowledgement: stored with identity, timestamp and a server-built snapshot; the alert itself is unchanged", async () => {
  const { db, sid, flagged } = await setup();
  const alert = flagged();
  const listJson = () => { const a = recordedAstronaut(SEED_ASTRONAUTS[0], snapshot(db)); return JSON.stringify(buildAlerts(a, a.sessions.find((s) => s.id === sid)!)); };
  const before = listJson();
  const r = ack(db, "astro-chen", sid, alert.id);
  assert.ok(r.ok && !r.value.duplicate);
  if (!r.ok) return;
  const e = r.value.entry;
  assert.equal(e.astronautId, "astro-chen"); assert.equal(e.sessionId, sid); assert.equal(e.acknowledgedAt, "2026-11-12T10:00:00.000Z");
  assert.equal(e.severity, alert.severity); assert.equal(e.values?.current, 114); assert.equal(e.values?.baseline, 121);
  assert.ok(Math.abs((e.values?.pctChange ?? 0) + 5.785) < 0.01);
  assert.equal(e.source?.side, "left");
  const snap = snapshot(db);
  assert.equal(snap.alertAcks.length, 1);
  assert.equal(listJson(), before); // not resolved, hidden or downgraded
  assert.equal(statusOf(snap.alertAcks, flagged()).kind, "seen");
});

test("repeated acknowledgement of unchanged data is a no-op; a changed finding appends and is reported as changed", async () => {
  const { db, sid, flagged } = await setup();
  const id = flagged().id;
  assert.ok(ack(db, "astro-chen", sid, id).ok);
  const again = ack(db, "astro-chen", sid, id, "2026-11-12T10:05:00.000Z");
  assert.ok(again.ok && again.value.duplicate); assert.equal(count(db), 1);
  // The data changes (maximum angle 118 -> 110): same finding, different numbers.
  assert.ok(updateSession(db, sid, K({ maxAngleDeg: 110 })).ok);
  const live = flagged();
  assert.equal(live.id, id);
  const st = statusOf(snapshot(db).alertAcks, live);
  assert.equal(st.kind, "changed");
  if (st.kind === "changed") { assert.equal(st.entry.values?.current, 114); assert.notEqual(live.values?.current, st.entry.values?.current); } // the entry still holds what was seen
  const second = ack(db, "astro-chen", sid, id, "2026-11-12T11:00:00.000Z");
  assert.ok(second.ok && !second.value.duplicate); assert.equal(count(db), 2);
  assert.equal(statusOf(snapshot(db).alertAcks, flagged()).kind, "seen");
  const hist = historyFor(snapshot(db).alertAcks, "astro-chen", null);
  assert.deepEqual(hist.map((h) => h.values?.current), [live.values?.current, 114]);
});

test("a severity change keeps the severity that was acknowledged", async () => {
  const { db, sid, flagged } = await setup();
  const first = flagged(); assert.equal(first.severity, "attention");
  assert.ok(ack(db, "astro-chen", sid, first.id).ok);
  assert.ok(updateSession(db, sid, K({ maxAngleDeg: 125 })).ok); // back in line with the baseline: the same status check now reads "All Good"
  const e = snapshot(db).alertAcks[0];
  assert.equal(e.severity, "attention"); assert.equal(e.severityLabel, first.label);
});

test("isolation: another astronaut's session, unknown ids and unknown findings are rejected and write nothing", async () => {
  const { db, sid, osid, flagged } = await setup();
  const id = flagged().id;
  const wrong = ack(db, "astro-okafor", sid, id); assert.ok(!wrong.ok && wrong.status === 403);
  const ghost = ack(db, "astro-chen", "rec-nope", id); assert.ok(!ghost.ok && ghost.status === 404);
  const noFinding = ack(db, "astro-chen", sid, "alert:does-not-exist"); assert.ok(!noFinding.ok && noFinding.status === 404);
  const noAstro = ack(db, "astro-nobody", sid, id); assert.ok(!noAstro.ok && noAstro.status === 404);
  assert.ok(!ack(db, "astro-chen", sid, "bad id!").ok);
  assert.ok(!acknowledgeAlert(db, { astronautId: 5, sessionId: sid, alertId: id }, snapshot(db)).ok);
  assert.equal(count(db), 0);
  // Okafor has his own alert: it never shows as seen for Chen and vice versa.
  const oa = recordedAstronaut(SEED_ASTRONAUTS[1], snapshot(db));
  const oAlert = buildAlerts(oa, oa.sessions.find((s) => s.id === osid)!).find((a) => a.severity !== "good")!;
  assert.ok(ack(db, "astro-okafor", osid, oAlert.id).ok);
  const acks = snapshot(db).alertAcks;
  assert.deepEqual(historyFor(acks, "astro-chen", null), []);
  assert.equal(historyFor(acks, "astro-okafor", null).length, 1);
  assert.equal(statusOf(acks, flagged()).kind, "unseen");
});

test("acknowledgements survive a database save and re-open", async () => {
  const { db, sid, flagged } = await setup();
  assert.ok(ack(db, "astro-chen", sid, flagged().id).ok);
  const reopened = new SQL.Database(db.export());
  reopened.run("PRAGMA foreign_keys = ON");
  assert.deepEqual(migrate(reopened), []);
  const snap = snapshot(reopened);
  assert.equal(snap.alertAcks.length, 1);
  assert.equal(snap.alertAcks[0].values?.current, 114);
  const a = recordedAstronaut(SEED_ASTRONAUTS[0], snap);
  assert.equal(statusOf(snap.alertAcks, buildAlerts(a, a.sessions.find((s) => s.id === sid)!).find((x) => x.severity !== "good")!).kind, "seen");
});

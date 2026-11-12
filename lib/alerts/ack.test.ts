import test from "node:test";
import assert from "node:assert/strict";
import { ASTRONAUTS } from "../demo/fixtures";
import { buildAlerts } from "./build";
import { addToStore, describeSeen, entryFor, fingerprintOf, flattenAcks, historyFor, parseAckStore, statusOf, wouldAdd, type AckStore } from "./ack";

const chen = ASTRONAUTS.find((a) => a.id === "astro-chen")!;
const okafor = ASTRONAUTS.find((a) => a.id === "astro-okafor")!;
const session = chen.sessions[chen.sessions.length - 1];
const alerts = buildAlerts(chen, session);
const top = alerts.find((a) => a.kind === "health" && a.severity !== "good")!;
const T1 = "2026-11-12T10:00:00.000Z", T2 = "2026-11-12T11:00:00.000Z";

test("an entry snapshots severity, values, source and identity", () => {
  const e = entryFor(top, T1, "ack-1");
  assert.equal(e.alertId, top.id); assert.equal(e.astronautId, "astro-chen"); assert.equal(e.sessionId, session.id);
  assert.equal(e.severity, top.severity); assert.equal(e.severityLabel, top.label); assert.deepEqual(e.values, top.values); assert.deepEqual(e.source, top.source);
  assert.equal(e.fingerprint, fingerprintOf(top));
  assert.notEqual(e.values, top.values); // a copy, not the live object
});

test("status: unseen -> seen; a changed finding is reported as changed since it was seen, and the entry keeps what was seen", () => {
  assert.equal(statusOf([], top).kind, "unseen");
  const e = entryFor(top, T1, "ack-1");
  assert.equal(statusOf([e], top).kind, "seen");
  const worse = { ...top, severity: "action" as const, label: "Action Required" };
  const st = statusOf([e], worse);
  assert.equal(st.kind, "changed");
  if (st.kind === "changed") { assert.equal(st.entry.severity, top.severity); assert.match(describeSeen(st.entry), new RegExp(top.label)); }
  const moved = { ...top, values: top.values ? { ...top.values, current: top.values.current - 3, pctChange: (top.values.pctChange ?? 0) - 2.5 } : null };
  assert.equal(statusOf([e], moved).kind, "changed");
  // Wording and next-action text are not part of the identity of what was seen.
  assert.equal(statusOf([e], { ...top, explanation: "different words", action: { ...top.action, label: "Something else" } }).kind, "seen");
});

test("marking as seen is idempotent for unchanged data and appends for a changed finding (history is kept)", () => {
  let store: AckStore = {};
  let r = addToStore(store, entryFor(top, T1, "a1")); store = r.store; assert.equal(r.added, true);
  r = addToStore(store, entryFor(top, T2, "a2")); assert.equal(r.added, false); assert.strictEqual(r.store, store);
  assert.equal(flattenAcks(store, "astro-chen").length, 1);
  const changed = { ...top, severity: "action" as const, label: "Action Required" };
  r = addToStore(store, entryFor(changed, T2, "a3")); store = r.store; assert.equal(r.added, true);
  assert.equal(flattenAcks(store, "astro-chen").length, 2);
  // Back to the first state is a new event, because the LATEST entry differs.
  r = addToStore(store, entryFor(top, "2026-11-12T12:00:00.000Z", "a4")); assert.equal(r.added, true);
  assert.equal(wouldAdd(flattenAcks(r.store, "astro-chen"), top), false);
});

test("acknowledging never changes the alert list itself", () => {
  const before = JSON.stringify(buildAlerts(chen, session));
  addToStore({}, entryFor(top, T1, "a1"));
  assert.equal(JSON.stringify(buildAlerts(chen, session)), before);
});

test("history is scoped to the astronaut and (optionally) the session, newest first", () => {
  const oSession = okafor.sessions[okafor.sessions.length - 1];
  const oTop = buildAlerts(okafor, oSession).find((a) => a.severity !== "good")!;
  let store: AckStore = {};
  store = addToStore(store, entryFor(top, T1, "a1")).store;
  store = addToStore(store, entryFor(oTop, T2, "o1")).store;
  const other = { ...top, sessionId: "sess-other", id: "alert:other" };
  store = addToStore(store, entryFor(other, T2, "a2")).store;
  const all = flattenAcks(store, "astro-chen");
  assert.deepEqual(historyFor(all, "astro-chen", null).map((e) => e.id), ["a2", "a1"]);
  assert.deepEqual(historyFor(all, "astro-chen", session.id).map((e) => e.id), ["a1"]);
  assert.deepEqual(historyFor(flattenAcks(store, "astro-okafor"), "astro-okafor", null).map((e) => e.id), ["o1"]);
  assert.deepEqual(historyFor([...all, ...flattenAcks(store, "astro-okafor")], "astro-okafor", null).map((e) => e.id), ["o1"]); // never mixes astronauts
  assert.equal(statusOf(flattenAcks(store, "astro-okafor"), top).kind, "unseen");
});

test("parsing drops malformed or mismatched entries and never throws", () => {
  const e = entryFor(top, T1, "a1");
  const p = parseAckStore({ "astro-chen": { [session.id]: { [top.id]: [e, { id: 1 }, { ...e, astronautId: "astro-okafor" }] }, bad: 5 }, x: null });
  assert.equal(flattenAcks(p, "astro-chen").length, 1);
  assert.deepEqual(parseAckStore("nope"), {}); assert.deepEqual(parseAckStore([]), {});
});

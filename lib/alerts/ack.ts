import type { Alert, AlertValues, Severity } from "./types";

// Alert history ("Mark as seen"). Pure logic shared by the browser (Demo, localStorage) and the server (Recorded, SQLite).
// Acknowledging records that an alert was SEEN, together with a snapshot of what it said at that moment. It never resolves, hides or
// downgrades the alert: the live alert is always recomputed from the data, and this module only compares it with what was seen.

export type AckEntry = {
  id: string;
  astronautId: string;
  sessionId: string;
  /** Identity of the finding: Alert.id (`alert:<finding id>` or `alert:<check>:<session id>`). */
  alertId: string;
  /** Source finding id when the alert comes from an insight finding, else null. */
  findingId: string | null;
  /** ISO 8601 UTC. */
  acknowledgedAt: string;
  /** What the alert said when it was seen. Changes when severity, measured values or source change. */
  fingerprint: string;
  severity: Severity;
  severityLabel: string;
  title: string;
  metric: string;
  values: AlertValues | null;
  source: Alert["source"];
  sessionLabel: string;
  missionDay: number;
  simulatedScenario: string | null;
};

const r2 = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);

/**
 * Stable text for "the same finding saying the same thing": severity, the measured values (rounded to 0.01), the source measurement and
 * the scenario label. The wording of explanations, next-action text and AI output are deliberately NOT part of it.
 */
export function fingerprintOf(a: Alert): string {
  const v = a.values;
  const s = a.source;
  return JSON.stringify([
    a.severity, a.label, a.title, a.metric, a.findingId,
    v ? [v.metricKey, r2(v.current), r2(v.baseline), r2(v.diff), r2(v.pctChange), v.baselineDay] : null,
    s ? [s.label, s.findingSource, s.side, s.tSec === null ? null : r2(s.tSec), s.sessionId] : null,
    a.simulatedScenario,
  ]);
}

/** The record kept when an alert is marked as seen. */
export function entryFor(a: Alert, acknowledgedAt: string, id: string): AckEntry {
  return {
    id, astronautId: a.astronautId, sessionId: a.sessionId, alertId: a.id, findingId: a.findingId, acknowledgedAt,
    fingerprint: fingerprintOf(a), severity: a.severity, severityLabel: a.label, title: a.title, metric: a.metric,
    values: a.values ? { ...a.values } : null, source: a.source ? { ...a.source } : null,
    sessionLabel: a.sessionLabel, missionDay: a.missionDay, simulatedScenario: a.simulatedScenario,
  };
}

const byTimeDesc = (x: AckEntry, y: AckEntry) => y.acknowledgedAt.localeCompare(x.acknowledgedAt) || y.id.localeCompare(x.id);

/** The most recent entry for one finding of one astronaut and session, or null. */
export function latestFor(entries: readonly AckEntry[], astronautId: string, sessionId: string, alertId: string): AckEntry | null {
  return entries.filter((e) => e.astronautId === astronautId && e.sessionId === sessionId && e.alertId === alertId).sort(byTimeDesc)[0] ?? null;
}

export type AckStatus =
  | { kind: "unseen" }
  | { kind: "seen"; entry: AckEntry }
  /** It was seen, but the live alert now says something different (severity, values or source). `entry` is what was seen. */
  | { kind: "changed"; entry: AckEntry };

export function statusOf(entries: readonly AckEntry[], a: Alert): AckStatus {
  const e = latestFor(entries, a.astronautId, a.sessionId, a.id);
  if (!e) return { kind: "unseen" };
  return e.fingerprint === fingerprintOf(a) ? { kind: "seen", entry: e } : { kind: "changed", entry: e };
}

/** Whether marking `a` as seen would add anything: false when its latest entry already says exactly the same (idempotent). */
export const wouldAdd = (entries: readonly AckEntry[], a: Alert) => statusOf(entries, a).kind !== "seen";

/** Newest first. `sessionId` null = every session of the astronaut. Other astronauts' entries are never included. */
export function historyFor(entries: readonly AckEntry[], astronautId: string, sessionId: string | null): AckEntry[] {
  return entries.filter((e) => e.astronautId === astronautId && (sessionId === null || e.sessionId === sessionId)).sort(byTimeDesc);
}

/** One-line description of what changed between what was seen and the live alert, for the "changed since" note. */
function describe(label: string, v: AlertValues | null): string {
  if (!v) return label;
  const pct = v.pctChange !== null ? `, ${v.pctChange > 0 ? "+" : v.pctChange < 0 ? "−" : ""}${Math.abs(Math.round(v.pctChange * 10) / 10)}%` : "";
  const now = `${Math.round(v.current * 10) / 10}°${v.baseline !== null ? ` vs ${Math.round(v.baseline * 10) / 10}° baseline` : ""}`;
  return `${label}${pct} (${now})`;
}
export const describeSeen = (e: AckEntry) => describe(e.severityLabel, e.values);
/** The same description for the live alert, so the "changed since" note can show both. */
export const describeAlert = (a: Pick<Alert, "label" | "values">) => describe(a.label, a.values);

// ---------------------------------------------------------------- Demo storage shape (localStorage)
export const ACK_DEMO_KEY = "aerorehab.alerts.seen.demo.v1";
/** { astronautId: { sessionId: { alertId: AckEntry[] } } }. Recorded acknowledgements are NOT stored here: they live in SQLite. */
export type AckStore = Record<string, Record<string, Record<string, AckEntry[]>>>;

const SEV: readonly string[] = ["good", "attention", "action", "neutral"];
const isEntry = (x: unknown): x is AckEntry => {
  if (!x || typeof x !== "object") return false;
  const e = x as Record<string, unknown>;
  return ["id", "astronautId", "sessionId", "alertId", "acknowledgedAt", "fingerprint", "severity", "severityLabel", "title", "metric", "sessionLabel"].every((k) => typeof e[k] === "string")
    && SEV.includes(e.severity as string) && typeof e.missionDay === "number";
};

/** Defensive parse: malformed entries are dropped, never thrown on. */
export function parseAckStore(raw: unknown): AckStore {
  const out: AckStore = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [aid, sessions] of Object.entries(raw as Record<string, unknown>)) {
    if (!sessions || typeof sessions !== "object") continue;
    for (const [sid, alerts] of Object.entries(sessions as Record<string, unknown>)) {
      if (!alerts || typeof alerts !== "object") continue;
      for (const [alertId, list] of Object.entries(alerts as Record<string, unknown>)) {
        if (!Array.isArray(list)) continue;
        const ok = list.filter(isEntry).filter((e) => e.astronautId === aid && e.sessionId === sid && e.alertId === alertId);
        if (ok.length) ((out[aid] ??= {})[sid] ??= {})[alertId] = ok;
      }
    }
  }
  return out;
}

export const flattenAcks = (store: AckStore, astronautId: string): AckEntry[] =>
  Object.values(store[astronautId] ?? {}).flatMap((alerts) => Object.values(alerts).flat());

/** Adds an entry unless the finding's latest entry already says the same. Never mutates its input. */
export function addToStore(store: AckStore, entry: AckEntry): { store: AckStore; added: boolean } {
  const list = store[entry.astronautId]?.[entry.sessionId]?.[entry.alertId] ?? [];
  const latest = [...list].sort(byTimeDesc)[0];
  if (latest && latest.fingerprint === entry.fingerprint) return { store, added: false };
  const next: AckStore = { ...store, [entry.astronautId]: { ...(store[entry.astronautId] ?? {}), [entry.sessionId]: { ...(store[entry.astronautId]?.[entry.sessionId] ?? {}), [entry.alertId]: [...list, entry] } } };
  return { store: next, added: true };
}

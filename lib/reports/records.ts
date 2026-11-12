import { inRange, metricRow, observationRows, previousRange, referenceContext, type MetricKey, type Range, type ReportPoint } from "./compute";
import { balanceView } from "../balance/records";
import { insightView } from "../insights/records";
import { DEMO_DAY } from "../rehab/records";
import type { AstronautRecord, Session } from "../demo/types";

export const MIN_DAY = 1;
export const MAX_DAY = DEMO_DAY;

export const METRIC_META: Record<MetricKey, { label: string; unit: string; digits: number; source: string }> = {
  romDeg: { label: "Knee ROM (flexion)", unit: "°", digits: 1, source: "Joint Analytics (peak flexion − minimum angle)" },
  speedMs: { label: "Walking Speed", unit: " m/s", digits: 2, source: "Gait Analysis" },
  cadenceSpm: { label: "Cadence", unit: " steps/min", digits: 0, source: "Gait Analysis" },
  balanceIndex: { label: "Balance Index", unit: " /100", digits: 0, source: "Stability & Balance (demo score)" },
};
export const METRIC_ORDER: MetricKey[] = ["romDeg", "speedMs", "cadenceSpm", "balanceIndex"];

/** One point per session, taken from the same records/selectors the module pages use. */
export function reportPoints(a: AstronautRecord): ReportPoint[] {
  return a.sessions.map((s) => ({
    astronautId: a.id,
    sessionId: s.id,
    missionDay: s.missionDay,
    knee: { side: s.joint.measurement.side, protocol: s.joint.measurement.protocol },
    romDeg: s.knee.romDeg,
    speedMs: s.gait?.speedMs ?? null,
    cadenceSpm: s.gait?.cadenceSpm ?? null,
    balanceIndex: balanceView(a, s, "left").fixtures?.index ?? null,
  }));
}

/** Walking sessions (recorded mode) as report points: speed and cadence only, with no knee context. */
function walkingPoints(a: AstronautRecord): ReportPoint[] {
  return (a.walking ?? []).map((w) => ({
    astronautId: a.id, sessionId: w.id, missionDay: w.missionDay, knee: { side: "", protocol: "" },
    romDeg: null, speedMs: w.speedMs, cadenceSpm: w.cadenceSpm, balanceIndex: null,
  }));
}

export type ReportScope = { kind: "session"; session: Session } | { kind: "history"; range: Range };

export function scopeRange(scope: ReportScope): Range {
  return scope.kind === "session" ? { start: scope.session.missionDay, end: scope.session.missionDay } : scope.range;
}

export function buildReport(a: AstronautRecord, scope: ReportScope) {
  const range = scopeRange(scope);
  const prevRange = previousRange(range);
  const points = [...reportPoints(a), ...walkingPoints(a)];
  const cur = inRange(points, a.id, range);
  const prev = inRange(points, a.id, prevRange);
  const ref = referenceContext(cur);
  const rows = METRIC_ORDER.map((m) => metricRow(m, cur, prev, ref));
  const latest = [...cur].filter((x) => x.knee.side !== "").sort((x, y) => x.missionDay - y.missionDay).pop();
  const latestSession = latest ? a.sessions.find((s) => s.id === latest.sessionId) ?? null : null;
  /** Chart rows: one per session observation in the range (see observationRows). */
  const series = (m: MetricKey) => observationRows(cur, m, ref);
  const inDays = <T extends { missionDay: number }>(l: readonly T[] | undefined) => (l ?? []).filter((x) => x.missionDay >= range.start && x.missionDay <= range.end);
  const pressure = inDays(a.pressure);
  const balance = inDays(a.balance);
  const kneeCount = cur.filter((p) => p.knee.side !== "").length;
  const walkingCount = cur.length - kneeCount;
  return {
    range,
    prevRange,
    /** Recorded pressure and balance assessments in the range (knee and walking points are in `cur`). */
    pressure,
    balance,
    kneeCount,
    walkingCount,
    /** True when ANY eligible record (knee, walking, pressure or balance) falls in the scope. */
    hasData: cur.length > 0 || pressure.length > 0 || balance.length > 0,
    cur,
    prev,
    ref,
    rows,
    series,
    insights: latestSession ? insightView(a, latestSession) : null,
    latestSession,
  };
}

/** The mission day a "Session report" uses when the astronaut has no knee session: the latest day with any recorded entry. */
export function latestRecordDay(a: AstronautRecord): number | null {
  const days = [...a.sessions.map((s) => s.missionDay), ...(a.walking ?? []).map((w) => w.missionDay), ...(a.pressure ?? []).map((x) => x.missionDay), ...(a.balance ?? []).map((x) => x.missionDay)];
  return days.length ? Math.max(...days) : null;
}

/** Which metric rows and charts have something to show. In recorded mode only supported sections appear; demo mode keeps all four. */
export function visibleMetrics(report: ReturnType<typeof buildReport>, recorded: boolean): MetricKey[] {
  if (!recorded) return METRIC_ORDER;
  return METRIC_ORDER.filter((m) => {
    if (m === "balanceIndex") return false; // no documented scoring method applies to recorded balance data
    const row = report.rows.find((r) => r.metric === m);
    return !!row && (row.current.kind === "value" || report.series(m).some((d) => d.value !== null));
  });
}

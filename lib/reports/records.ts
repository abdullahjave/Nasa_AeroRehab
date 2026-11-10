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

export type ReportScope = { kind: "session"; session: Session } | { kind: "history"; range: Range };

export function scopeRange(scope: ReportScope): Range {
  return scope.kind === "session" ? { start: scope.session.missionDay, end: scope.session.missionDay } : scope.range;
}

export function buildReport(a: AstronautRecord, scope: ReportScope) {
  const range = scopeRange(scope);
  const prevRange = previousRange(range);
  const points = reportPoints(a);
  const cur = inRange(points, a.id, range);
  const prev = inRange(points, a.id, prevRange);
  const ref = referenceContext(cur);
  const rows = METRIC_ORDER.map((m) => metricRow(m, cur, prev, ref));
  const latest = [...cur].sort((x, y) => x.missionDay - y.missionDay).pop();
  const latestSession = latest ? a.sessions.find((s) => s.id === latest.sessionId) ?? null : null;
  /** Chart rows: one per session observation in the range (see observationRows). */
  const series = (m: MetricKey) => observationRows(cur, m, ref);
  return {
    range,
    prevRange,
    cur,
    prev,
    ref,
    rows,
    series,
    insights: latestSession ? insightView(a, latestSession) : null,
    latestSession,
  };
}

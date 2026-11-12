import { compare, dataGaps, dedupeById, isComparableBaseline, meetsReducedRom, overlayRows, peakRepetition, type Comparison, type IM, type RepCurve } from "./compute";
import { REDUCED_ROM_DEMO } from "./config";
import { buildKneeSeries } from "../demo/knee-series";
import type { AstronautRecord, KneeSample, Session } from "../demo/types";

/** One timeline event. "measured" = derived from the knee samples; "seeded" = demo scenario fixture. */
export type AnomalyEvent = { id: string; tSec: number; toSec?: number; label: string; detail: string; source: "measured" | "seeded" };

export type Finding = {
  id: string;
  kind: "reduced-rom" | "scenario-event" | "data-gap";
  source: "calculated" | "seeded" | "measured";
  title: string;
  /** Plain description built from the observed values; no causes are inferred. */
  text: string;
  metric: string;
  tSec: number | null;
};

export type InsightView = {
  session: Session;
  context: Session["joint"]["measurement"];
  baselineComparable: boolean;
  baselineDay: number | null;
  peak: Comparison;
  rom: Comparison;
  romFlagged: boolean;
  events: AnomalyEvent[];
  previousEventCount: number | null;
  findings: Finding[];
  fatigue: Session["fatigue"];
  chart: { current: IM<RepCurve>; baseline: IM<RepCurve>; rows: ReturnType<typeof overlayRows> };
};

const baselineCache = new Map<string, KneeSample[]>();

/** Simulated baseline recording regenerated from the baseline fixture, for the repetition overlay only. */
function baselineSamples(session: Session): KneeSample[] | null {
  const b = session.joint.baseline;
  if (!b || !b.reference) return null; // recorded baselines have no trace to regenerate
  const key = `${session.astronautId}-${b.recordedMissionDay}-${b.protocol}`;
  const hit = baselineCache.get(key);
  if (hit) return hit;
  const min = b.peakFlexionDeg - b.romDeg;
  const s = buildKneeSeries({
    count: 300, intervalSec: 2, peakDeg: b.peakFlexionDeg, minDeg: min, currentDeg: min + 0.4 * b.romDeg,
    repPeriodSec: b.reference.repPeriodSec, peakRep: 12, phase: b.reference.phase,
  });
  baselineCache.set(key, s);
  return s;
}

function eventsOf(session: Session): AnomalyEvent[] {
  const gaps = dataGaps(session.kneeSamples).map((g) => ({
    id: `gap-${session.id}-${g.startIdx}`,
    tSec: g.fromSec,
    toSec: g.toSec,
    label: "Knee data gap",
    detail: `No knee samples from ${g.fromSec} s to ${g.toSec} s (measured from the session samples).`,
    source: "measured" as const,
  }));
  const seeded = session.scenarioEvents.map((e) => ({ ...e, source: "seeded" as const }));
  return dedupeById([...gaps, ...seeded]).sort((a, b) => a.tSec - b.tSec);
}

/** Display formatting with a typographic minus, matching the cards. */
const fmt = (n: number, d = 1) => n.toFixed(d).replace("-", "−");

/** The one selector for AI Insights, the Overview insight preview and the Joint Analytics baseline card. */
export function insightView(a: AstronautRecord, session: Session): InsightView {
  const ctx = session.joint.measurement;
  const base = session.joint.baseline;
  const comparable = isComparableBaseline(ctx, base);
  const peak = compare(session.knee.peakFlexionDeg, base?.peakFlexionDeg, comparable);
  const rom = compare(session.knee.romDeg, base?.romDeg, comparable);
  const romFlagged = meetsReducedRom(rom, REDUCED_ROM_DEMO);

  const events = eventsOf(session);
  const idx = a.sessions.findIndex((s) => s.id === session.id);
  const previous = idx > 0 ? a.sessions[idx - 1] : null;

  const findings: Finding[] = [];
  if (romFlagged && rom.current.kind === "value" && rom.baseline.kind === "value" && rom.diff.kind === "value" && rom.pct.kind === "value") {
    findings.push({
      id: `find-${session.id}-reduced-rom`,
      kind: "reduced-rom",
      source: "calculated",
      title: "Reduced ROM Detected",
      metric: "Knee range of motion",
      text: `ROM was ${fmt(rom.current.value)}° vs a personal baseline of ${fmt(rom.baseline.value)}° (Day ${base?.recordedMissionDay}): ${fmt(rom.diff.value)}° (${fmt(rom.pct.value)}%). The demo rule flags changes of ${fmt(REDUCED_ROM_DEMO.thresholdPct, 0)}% or lower.`,
      tSec: null,
    });
  }
  for (const e of events) {
    findings.push({
      id: e.id,
      kind: e.source === "measured" ? "data-gap" : "scenario-event",
      source: e.source,
      title: e.label,
      metric: e.source === "measured" ? "Knee sample coverage" : "Movement pattern (demo scenario)",
      text: e.detail,
      tSec: e.tSec,
    });
  }

  const cur = peakRepetition(session.kneeSamples);
  const bs = comparable ? baselineSamples(session) : null;
  const baseRep: IM<RepCurve> = bs ? peakRepetition(bs) : { kind: "unavailable", reason: "no-comparable-baseline" };

  return {
    session,
    context: ctx,
    baselineComparable: comparable,
    baselineDay: comparable && base ? base.recordedMissionDay : null,
    peak,
    rom,
    romFlagged,
    events,
    previousEventCount: previous ? eventsOf(previous).length : null,
    findings: dedupeById(findings),
    fatigue: session.fatigue,
    chart: {
      current: cur,
      baseline: baseRep,
      rows: overlayRows(cur.kind === "value" ? cur.value : null, baseRep.kind === "value" ? baseRep.value : null),
    },
  };
}

export const IREASON_TEXT: Record<string, string> = {
  "missing-measurement": "Measurement missing",
  "no-comparable-baseline": "No comparable baseline",
  "invalid-baseline": "Baseline not valid for a percent change",
  "no-repetition": "No complete repetition",
};

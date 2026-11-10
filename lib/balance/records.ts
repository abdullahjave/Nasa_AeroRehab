import { percentChange, summarizeTrial } from "./compute";
import { buildTrial } from "./simulate";
import type { BMetric, BalanceProtocol, BalanceTrial, TrialSide, TrialSummary } from "./types";
import type { AstronautRecord, Session } from "../demo/types";

export const DEFAULT_PROTOCOL: BalanceProtocol = "single-leg-stance-eyes-open";
export const PROTOCOL_LABEL: Record<BalanceProtocol, string> = { "single-leg-stance-eyes-open": "Single-leg stance, eyes open" };

const trialCache = new Map<string, BalanceTrial>();
const summaryCache = new Map<string, TrialSummary>();

/** Every trial of an astronaut, oldest first. */
export function allTrials(a: AstronautRecord): BalanceTrial[] {
  return a.balanceTrials
    .map((spec) => {
      const hit = trialCache.get(spec.id);
      if (hit) return hit;
      const t = buildTrial(spec, a.id);
      trialCache.set(spec.id, t);
      return t;
    })
    .sort((x, y) => x.missionDay - y.missionDay);
}

export function summaryOf(t: BalanceTrial): TrialSummary {
  const hit = summaryCache.get(t.id);
  if (hit) return hit;
  const s = summarizeTrial(t.samples, t.sampleRateHz);
  summaryCache.set(t.id, s);
  return s;
}

export function trialFor(a: AstronautRecord, sessionId: string, side: TrialSide, protocol = DEFAULT_PROTOCOL): BalanceTrial | null {
  return allTrials(a).find((t) => t.sessionId === sessionId && t.side === side && t.protocol === protocol) ?? null;
}

/** Comparable trials: same astronaut, side and protocol, oldest first. */
export function trialHistory(a: AstronautRecord, side: TrialSide, protocol = DEFAULT_PROTOCOL): BalanceTrial[] {
  return allTrials(a).filter((t) => t.side === side && t.protocol === protocol);
}

/** Personal baseline = the earliest comparable trial before the current one. */
export function baselineFor(a: AstronautRecord, current: BalanceTrial): BalanceTrial | null {
  const earlier = trialHistory(a, current.side, current.protocol).filter((t) => t.missionDay < current.missionDay);
  return earlier[0] ?? null;
}

export type BalanceView = {
  session: Session;
  side: TrialSide;
  protocol: BalanceProtocol;
  /** Session-level demo fixtures (Balance Index, radar, scenario flag). */
  fixtures: Session["balance"];
  trial: BalanceTrial | null;
  summary: TrialSummary | null;
  other: { trial: BalanceTrial | null; summary: TrialSummary | null };
  baseline: { trial: BalanceTrial; summary: TrialSummary } | null;
  areaChangePct: BMetric<number>;
  rmsChangePct: BMetric<number>;
  history: { trial: BalanceTrial; summary: TrialSummary }[];
};

const NO_TRIAL: BMetric<never> = { kind: "unavailable", reason: "no-trial" };

/** One selector used by both Overview and Stability & Balance, so both show the same numbers. */
export function balanceView(a: AstronautRecord, session: Session, side: TrialSide, protocol = DEFAULT_PROTOCOL): BalanceView {
  const trial = trialFor(a, session.id, side, protocol);
  const summary = trial ? summaryOf(trial) : null;
  const otherSide: TrialSide = side === "left" ? "right" : "left";
  const otherTrial = trialFor(a, session.id, otherSide, protocol);
  const base = trial ? baselineFor(a, trial) : null;
  const baseSummary = base ? summaryOf(base) : null;
  const area = (s: TrialSummary | null): BMetric<number> =>
    s ? (s.ellipse.kind === "value" ? { kind: "value", value: s.ellipse.value.areaMm2 } : s.ellipse) : NO_TRIAL;
  return {
    session,
    side,
    protocol,
    fixtures: session.balance,
    trial,
    summary,
    other: { trial: otherTrial, summary: otherTrial ? summaryOf(otherTrial) : null },
    baseline: base && baseSummary ? { trial: base, summary: baseSummary } : null,
    areaChangePct: summary ? percentChange(area(summary), baseSummary ? area(baseSummary) : null) : NO_TRIAL,
    rmsChangePct: summary ? percentChange(summary.rmsResultantMm, baseSummary?.rmsResultantMm) : NO_TRIAL,
    history: trialHistory(a, side, protocol).map((t) => ({ trial: t, summary: summaryOf(t) })),
  };
}

export const REASON_LABEL: Record<string, string> = {
  "no-samples": "No samples",
  "insufficient-coverage": "Too little valid data",
  "too-few-points": "Too few points",
  degenerate: "Not enough spread for an ellipse",
  "invalid-input": "Invalid data",
  "no-baseline": "No comparable baseline",
  "no-trial": "No trial for this side",
};

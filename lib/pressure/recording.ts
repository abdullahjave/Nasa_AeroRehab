import { analyzeFrame, analyzeSession } from "./compute";
import { buildRecording, type PressureSpec } from "./simulate";
import type { FrameAnalysis, PressureFrame, SessionAnalysis } from "./types";
import type { AstronautRecord, Session } from "../demo/types";

export type PressureAnalysis = {
  spec: PressureSpec;
  frames: PressureFrame[];
  analyses: FrameAnalysis[];
  session: SessionAnalysis;
  frameIntervalMs: number;
  durationMs: number;
};

const cache = new Map<string, PressureAnalysis>();

function analyze(spec: PressureSpec): PressureAnalysis {
  const frames = buildRecording(spec);
  const analyses = frames.map(analyzeFrame);
  return {
    spec,
    frames,
    analyses,
    session: analyzeSession(analyses),
    frameIntervalMs: 1000 / spec.sampleRateHz,
    durationMs: frames.length ? frames[frames.length - 1].timestampMs : 0,
  };
}

/** The single source of pressure data for every page: samples -> per-frame and per-session metrics. */
export function getPressureAnalysis(session: Session): PressureAnalysis | null {
  if (!session.pressureSpec) return null;
  const hit = cache.get(session.id);
  if (hit) return hit;
  const made = analyze(session.pressureSpec);
  cache.set(session.id, made);
  return made;
}

export type TrendRow = {
  label: string;
  missionDay: number;
  peakKpa: number | null;
  differencePp: number | null;
  /** "session" = both insoles recorded; "partial" = only one insole recorded (the peak is that foot's own peak, the left/right difference is unavailable); "none" = no insole recording. */
  source: "session" | "partial" | "none";
};

/**
 * Per-session peak pressure and left/right difference for the Load Trend: one point per session that has an insole recording, in date order
 * (the last `max`). Nothing is invented: a day without a session has no point. When one insole is offline the point is that foot's own peak.
 */
export function pressureTrend(a: AstronautRecord, max = 8): TrendRow[] {
  const sessions = [...a.sessions].filter((s) => s.pressureSpec).sort((x, y) => x.missionDay - y.missionDay).slice(-max);
  return sessions.map((s) => {
    const m = getPressureAnalysis(s)?.session;
    const val = (x: { kind: string; value?: number } | undefined) => (x && x.kind === "value" ? (x.value as number) : null);
    const [all, l, r] = [val(m?.peakKpa.overall), val(m?.peakKpa.left), val(m?.peakKpa.right)];
    const peak = all ?? (l !== null && r === null ? l : r !== null && l === null ? r : null);
    const diff = val(m?.meanDifferencePp);
    return { label: `Day ${s.missionDay}`, missionDay: s.missionDay, peakKpa: peak, differencePp: diff, source: peak === null ? "none" : all !== null ? "session" : "partial" };
  });
}

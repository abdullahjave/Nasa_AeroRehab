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
  /** "session" = a real session of this dataset; "backfill" = same generator, scaled, for a day without a session. */
  source: "session" | "backfill" | "none";
};

/** Per-day peak pressure and left/right difference for the trend chart. */
export function pressureTrend(a: AstronautRecord): TrendRow[] {
  const withSpec = [...a.sessions].reverse().find((s) => s.pressureSpec);
  return a.trend.map((t) => {
    const real = a.sessions.find((s) => s.id === t.sessionId);
    let analysis: PressureAnalysis | null = null;
    let source: TrendRow["source"] = "none";
    if (real) {
      // A real session without an insole recording is a gap, never backfilled.
      analysis = getPressureAnalysis(real);
      source = analysis ? "session" : "none";
    } else if (withSpec?.pressureSpec) {
      // Earlier days: same generator, amplitude eased by 1.2% per day, different phase. Labelled as backfill.
      const back = withSpec.missionDay - t.missionDay;
      const base = withSpec.pressureSpec;
      const factor = 1 - 0.012 * Math.max(0, back);
      const scaled = (side: "left" | "right") =>
        Object.fromEntries(Object.entries(base.peaksKpa[side]).map(([k, v]) => [k, Math.round(v * factor * 10) / 10])) as PressureSpec["peaksKpa"]["left"];
      const key = `${a.id}-backfill-${t.missionDay}`;
      analysis = cache.get(key) ?? analyze({ ...base, seed: base.seed + back * 0.7, peaksKpa: { left: scaled("left"), right: scaled("right") } });
      cache.set(key, analysis);
      source = "backfill";
    }
    const peak = analysis?.session.peakKpa.overall;
    const diff = analysis?.session.meanDifferencePp;
    return {
      label: t.label,
      missionDay: t.missionDay,
      peakKpa: peak && peak.kind === "value" ? peak.value : null,
      differencePp: diff && diff.kind === "value" ? diff.value : null,
      source,
    };
  });
}
